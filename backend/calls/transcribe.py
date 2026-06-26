import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import requests
import tempfile
from groq import Groq
from config import GROQ_API_KEY, TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN

_groq = Groq(api_key=GROQ_API_KEY)


def transcribe_audio_url(audio_url: str) -> str:
    """
    Download audio from Twilio URL and transcribe using Groq Whisper API.
    """
    try:
        response = requests.get(
            audio_url,
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)
        )

        if response.status_code != 200:
            print(f"[transcribe] Failed to download audio: {response.status_code}")
            return ""

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp.write(response.content)
            tmp_path = tmp.name

        text = _transcribe_file(tmp_path, filename="recording.wav")
        return text

    except Exception as e:
        print(f"[transcribe] Error: {e}")
        return ""
    finally:
        try:
            if 'tmp_path' in locals():
                os.unlink(tmp_path)
        except Exception:
            pass


def transcribe_audio_file(file_path: str) -> str:
    """Transcribe a local audio file using Groq Whisper API."""
    return _transcribe_file(file_path, filename=os.path.basename(file_path))


def _transcribe_file(file_path: str, filename: str) -> str:
    """Core transcription function using Groq API."""
    try:
        with open(file_path, "rb") as f:
            result = _groq.audio.transcriptions.create(
                model="whisper-large-v3-turbo",
                file=(filename, f),
                response_format="text",
                language="en",
            )
        text = result.strip() if isinstance(result, str) else result.text.strip()
        print(f"[transcribe] Transcribed: {text}")
        return text
    except Exception as e:
        print(f"[transcribe] Groq transcription error: {e}")
        return ""


# ─── Quick test ───
if __name__ == "__main__":
    test_file = r"C:\Users\mishr\OneDrive\Desktop\AGENTIC-HR\public\audio\calls\opening.mp3"

    if os.path.exists(test_file):
        print("Testing transcription on: opening.mp3")
        text = transcribe_audio_file(test_file)
        print(f"\nResult: {text}")
    else:
        print("File not found")