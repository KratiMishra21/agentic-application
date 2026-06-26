import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from gtts import gTTS

# ─── Audio output directory ───
AUDIO_DIR = os.path.join(os.path.dirname(__file__), '..', '..', 'public', 'audio', 'calls')
os.makedirs(AUDIO_DIR, exist_ok=True)


def text_to_speech(text: str, filename: str) -> str | None:
    """
    Convert text to speech using Google TTS and save as MP3.
    Returns public URL path or None if failed.
    """
    try:
        tts = gTTS(text=text, lang='en', slow=False)
        file_path = os.path.join(AUDIO_DIR, f"{filename}.mp3")
        tts.save(file_path)
        print(f"[voice] Saved audio: {filename}.mp3")
        return f"/audio/calls/{filename}.mp3"
    except Exception as e:
        print(f"[voice] Failed to generate audio for {filename}: {e}")
        return None


STATIC_SCRIPTS = {
    "opening": (
        "Hello, this is an automated H R screening call. "
        "I am an AI assistant and this call is being transcribed to help our H R team review your application. "
        "Do you consent to proceed with this screening? Please say yes or no."
    ),
    "consent_declined": (
        "No problem at all. Thank you for your time. "
        "Our H R team may reach out to you directly. Have a great day. Goodbye."
    ),
    "salary_question": (
        "Thank you for agreeing to proceed. "
        "Could you please tell me your expected monthly salary in rupees?"
    ),
    "salary_over_budget": (
        "Thank you for sharing that. "
        "The budget for this role is slightly different from what you mentioned. "
        "Would you be open to aligning with the company's budget range?"
    ),
    "salary_rejected": (
        "I completely understand. Thank you so much for your time today. "
        "We will keep your profile on file for future opportunities. Have a wonderful day. Goodbye."
    ),
    "transition_to_hr": (
        "Great. Let us move on to a few standard questions. Please take your time with each answer."
    ),
    "closing": (
        "Thank you so much for your time today. "
        "Our H R team will review your responses and get back to you within a few business days. "
        "Have a wonderful day. Goodbye."
    ),
}


def generate_static_audio():
    """Pre-generate all fixed audio files. Run once before starting calls."""
    print("[voice] Generating static audio files...")
    for name, script in STATIC_SCRIPTS.items():
        existing = os.path.join(AUDIO_DIR, f"{name}.mp3")
        if os.path.exists(existing):
            print(f"[voice] Already exists, skipping: {name}.mp3")
            continue
        text_to_speech(script, name)


def generate_question_audio(question_text: str, question_index: int) -> str | None:
    """Generate audio for a specific HR interview question."""
    filename = f"q{question_index}"
    existing = os.path.join(AUDIO_DIR, f"{filename}.mp3")
    if os.path.exists(existing):
        return f"/audio/calls/{filename}.mp3"
    return text_to_speech(question_text, filename)


if __name__ == "__main__":
    generate_static_audio()
    print("\nAll static audio files generated.")
    print(f"Files saved to: {AUDIO_DIR}")
    print("\nFiles created:")
    for f in os.listdir(AUDIO_DIR):
        size = os.path.getsize(os.path.join(AUDIO_DIR, f))
        print(f"  {f} — {size:,} bytes")