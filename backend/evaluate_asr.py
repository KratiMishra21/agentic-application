"""
evaluate_asr.py
---------------
Compares Groq Whisper vs Google Cloud STT on HR screening audio.

Place inside backend/ and run:
    python evaluate_asr.py --audio_dir ./asr_test_audio --ground_truth ground_truth.csv

ground_truth.csv format (create this manually):
    filename,transcript
    recording_01.wav,"My expected salary is around 8 lakhs per annum"
    recording_02.wav,"I have a notice period of thirty days"
    ...
"""

import os, sys, time, csv, argparse
import requests

# ── Groq Whisper (your system) ─────────────────────────────────────────────
def transcribe_whisper(audio_path: str, groq_api_key: str) -> tuple:
    """Transcribe using Groq-hosted Whisper (whisper-large-v3-turbo)."""
    t0 = time.time()
    try:
        with open(audio_path, "rb") as f:
            response = requests.post(
                "https://api.groq.com/openai/v1/audio/transcriptions",
                headers={"Authorization": f"Bearer {groq_api_key}"},
                files={"file": (os.path.basename(audio_path), f, "audio/wav")},
                data={
                    "model": "whisper-large-v3-turbo",
                    "language": "en",
                    "response_format": "text"
                },
                timeout=30
            )
        latency = round(time.time() - t0, 3)
        if response.status_code == 200:
            return response.text.strip(), latency, None
        else:
            return "", latency, response.text
    except Exception as e:
        return "", round(time.time() - t0, 3), str(e)


# ── Google Cloud STT (baseline) ────────────────────────────────────────────
def transcribe_google(audio_path: str, google_credentials_path: str) -> tuple:
    """Transcribe using Google Cloud Speech-to-Text."""
    try:
        from google.cloud import speech
        from google.oauth2 import service_account
        import io

        credentials = service_account.Credentials.from_service_account_file(
            google_credentials_path
        )
        client = speech.SpeechClient(credentials=credentials)

        with io.open(audio_path, "rb") as f:
            audio_content = f.read()

        audio = speech.RecognitionAudio(content=audio_content)
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.LINEAR16,
            sample_rate_hertz=8000,   # Twilio recordings are 8kHz
            language_code="en-IN",    # Indian English — important for your use case
            alternative_language_codes=["en-US"],
            enable_automatic_punctuation=True,
        )

        t0 = time.time()
        response = client.recognize(config=config, audio=audio)
        latency = round(time.time() - t0, 3)

        transcript = " ".join(
            result.alternatives[0].transcript
            for result in response.results
        ).strip()

        return transcript, latency, None

    except ImportError:
        return "", 0.0, "google-cloud-speech not installed. Run: pip install google-cloud-speech"
    except Exception as e:
        return "", 0.0, str(e)


def transcribe_assemblyai(audio_path: str, api_key: str) -> tuple:
    """Transcribe using AssemblyAI — free tier, no credit card."""
    try:
        import assemblyai as aai
        aai.settings.api_key = api_key
        t0 = time.time()
        transcriber = aai.Transcriber()
        transcript = transcriber.transcribe(audio_path)
        latency = round(time.time() - t0, 3)
        if transcript.status.value == "error":
            return "", latency, transcript.error
        return transcript.text.strip(), latency, None
    except Exception as e:
        return "", 0.0, str(e)


# ── Word Error Rate ────────────────────────────────────────────────────────
def compute_wer(reference: str, hypothesis: str) -> float:
    """
    Word Error Rate = (S + D + I) / N
    S=substitutions, D=deletions, I=insertions, N=words in reference
    """
    ref = reference.lower().strip().split()
    hyp = hypothesis.lower().strip().split()

    if len(ref) == 0:
        return 0.0 if len(hyp) == 0 else 1.0

    # Dynamic programming (edit distance on words)
    d = [[0] * (len(hyp) + 1) for _ in range(len(ref) + 1)]
    for i in range(len(ref) + 1):
        d[i][0] = i
    for j in range(len(hyp) + 1):
        d[0][j] = j

    for i in range(1, len(ref) + 1):
        for j in range(1, len(hyp) + 1):
            if ref[i-1] == hyp[j-1]:
                d[i][j] = d[i-1][j-1]
            else:
                d[i][j] = 1 + min(d[i-1][j], d[i][j-1], d[i-1][j-1])

    return round(d[len(ref)][len(hyp)] / len(ref), 4)


def word_accuracy(wer: float) -> float:
    return round(max(0.0, 1.0 - wer) * 100, 2)


# ── Main ───────────────────────────────────────────────────────────────────
def run_asr_evaluation(audio_dir, ground_truth_csv, output_csv,
                       groq_api_key, google_credentials_path=None, assemblyai_key=None):

    # Load ground truth
    gt = {}
    with open(ground_truth_csv, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            gt[row["filename"]] = row["transcript"]

    print(f"\nLoaded {len(gt)} ground truth transcripts")
    print(f"Google STT: {'enabled' if google_credentials_path else 'DISABLED (no credentials)'}")

    results = []

    for fname, reference in gt.items():
        audio_path = os.path.join(audio_dir, fname)
        if not os.path.exists(audio_path):
            print(f"  SKIP (file not found): {fname}")
            continue

        print(f"\nProcessing: {fname}")
        print(f"  Reference: {reference}")

        # Whisper
        w_text, w_lat, w_err = transcribe_whisper(audio_path, groq_api_key)
        if w_err:
            print(f"  [Whisper ERROR] {w_err[:80]}")
        w_wer = compute_wer(reference, w_text)
        print(f"  Whisper ({w_lat}s): {w_text}")
        print(f"  Whisper WER: {w_wer:.4f} | Accuracy: {word_accuracy(w_wer)}%")

        # Google STT
        if google_credentials_path:
            g_text, g_lat, g_err = transcribe_google(audio_path, google_credentials_path)
            if g_err:
                print(f"  [Google ERROR] {g_err[:80]}")
            g_wer = compute_wer(reference, g_text)
            print(f"  Google  ({g_lat}s): {g_text}")
            print(f"  Google WER:  {g_wer:.4f} | Accuracy: {word_accuracy(g_wer)}%")
        else:
            g_text, g_lat, g_wer = "N/A", 0.0, None

        # AssemblyAI
        if assemblyai_key:
            a_text, a_lat, a_err = transcribe_assemblyai(audio_path, assemblyai_key)
            if a_err:
                print(f"  [AssemblyAI ERROR] {a_err[:80]}")
            a_wer = compute_wer(reference, a_text)
            print(f"  AssemblyAI ({a_lat}s): {a_text}")
            print(f"  AssemblyAI WER: {a_wer:.4f} | Accuracy: {word_accuracy(a_wer)}%")
        else:
            a_text, a_lat, a_wer = "N/A", 0.0, None

        # Determine per-file winner (prefer AssemblyAI comparison if enabled)
        if assemblyai_key:
            if a_wer is not None:
                if w_wer < a_wer:
                    winner = "whisper"
                elif a_wer < w_wer:
                    winner = "assemblyai"
                else:
                    winner = "tie"
            else:
                winner = "whisper_only"
        elif google_credentials_path:
            if g_wer is not None:
                if w_wer < g_wer:
                    winner = "whisper"
                elif g_wer < w_wer:
                    winner = "google"
                else:
                    winner = "tie"
            else:
                winner = "whisper_only"
        else:
            winner = "whisper_only"

        results.append({
            "filename": fname,
            "reference": reference,
            "whisper_transcript": w_text,
            "whisper_wer": w_wer,
            "whisper_word_accuracy_pct": word_accuracy(w_wer),
            "whisper_latency_s": w_lat,
            "google_transcript": g_text,
            "google_wer": g_wer,
            "google_word_accuracy_pct": word_accuracy(g_wer) if g_wer is not None else "N/A",
            "google_latency_s": g_lat,
            "assemblyai_transcript": a_text,
            "assemblyai_wer": a_wer,
            "assemblyai_word_accuracy_pct": word_accuracy(a_wer) if a_wer is not None else "N/A",
            "assemblyai_latency_s": a_lat,
            "winner": winner
        })

    # Save CSV
    if results:
        with open(output_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=results[0].keys())
            writer.writeheader()
            writer.writerows(results)
        print(f"\n✅ Results saved → {output_csv}")

    # Summary
    n = len(results)
    if n > 0:
        avg_w_wer = sum(r["whisper_wer"] for r in results) / n
        avg_w_lat = sum(r["whisper_latency_s"] for r in results) / n

        print(f"\n{'='*55}")
        print(f"ASR COMPARISON SUMMARY — {n} audio files")
        print(f"{'='*55}")
        print(f"Groq Whisper (whisper-large-v3-turbo):")
        print(f"  Avg WER:      {avg_w_wer:.4f}")
        print(f"  Avg Accuracy: {word_accuracy(avg_w_wer)}%")
        print(f"  Avg Latency:  {avg_w_lat:.3f}s")

        if google_credentials_path:
            valid_g = [r for r in results if r["google_wer"] is not None]
            if valid_g:
                avg_g_wer = sum(r["google_wer"] for r in valid_g) / len(valid_g)
                avg_g_lat = sum(r["google_latency_s"] for r in valid_g) / len(valid_g)
                print(f"\nGoogle Cloud Speech-to-Text:")
                print(f"  Avg WER:      {avg_g_wer:.4f}")
                print(f"  Avg Accuracy: {word_accuracy(avg_g_wer)}%")
                print(f"  Avg Latency:  {avg_g_lat:.3f}s")

                whisper_wins = sum(1 for r in results if r["winner"] == "whisper")
                google_wins = sum(1 for r in results if r["winner"] == "google")
                ties = sum(1 for r in results if r["winner"] == "tie")
                print(f"\nPer-file winner: Whisper={whisper_wins} | Google={google_wins} | Tie={ties}")
                print(f"WER delta (W-G): {avg_w_wer - avg_g_wer:+.4f}")

        # AssemblyAI summary
        if assemblyai_key:
            valid_a = [r for r in results if r["assemblyai_wer"] is not None]
            if valid_a:
                avg_a_wer = sum(r["assemblyai_wer"] for r in valid_a) / len(valid_a)
                avg_a_lat = sum(r["assemblyai_latency_s"] for r in valid_a) / len(valid_a)
                print(f"\nAssemblyAI:")
                print(f"  Avg WER:      {avg_a_wer:.4f}")
                print(f"  Avg Accuracy: {word_accuracy(avg_a_wer)}%")
                print(f"  Avg Latency:  {avg_a_lat:.3f}s")
                whisper_wins = sum(1 for r in results if r["winner"] == "whisper")
                assembly_wins = sum(1 for r in results if r["winner"] == "assemblyai")
                ties = sum(1 for r in results if r["winner"] == "tie")
                print(f"\nPer-file winner: Whisper={whisper_wins} | AssemblyAI={assembly_wins} | Tie={ties}")

        print(f"{'='*55}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio_dir", default="./asr_test_audio",
                        help="Folder with .wav files")
    parser.add_argument("--ground_truth", default="./ground_truth.csv",
                        help="CSV with filename,transcript columns")
    parser.add_argument("--output", default="asr_results.csv")
    parser.add_argument("--groq_key", default=None,
                        help="Groq API key (or set GROQ_API_KEY env var)")
    parser.add_argument("--google_creds", default=None,
                        help="Path to Google service account JSON (optional)")
    parser.add_argument("--assemblyai_key", default=None,
                        help="AssemblyAI API key (free tier at assemblyai.com)")
    args = parser.parse_args()

    # Get Groq key
    groq_key = args.groq_key or os.environ.get("GROQ_API_KEY")
    if not groq_key:
        print("ERROR: Provide --groq_key or set GROQ_API_KEY environment variable")
        sys.exit(1)

    run_asr_evaluation(
        args.audio_dir,
        args.ground_truth,
        args.output,
        groq_key,
        args.google_creds,
        args.assemblyai_key,
    )