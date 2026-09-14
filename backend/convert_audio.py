# convert_audio.py — run from backend/
import os
from pydub import AudioSegment

audio_dir = "./asr_test_audio"
for fname in os.listdir(audio_dir):
    if fname.endswith(".wav"):
        path = os.path.join(audio_dir, fname)
        audio = AudioSegment.from_file(path)
        # Convert to mono, 16kHz, 16-bit — what Whisper prefers
        audio = audio.set_channels(1).set_frame_rate(16000).set_sample_width(2)
        audio.export(path, format="wav")
        print(f"Converted: {fname}")