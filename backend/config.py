import os
from dotenv import load_dotenv
from supabase import create_client, Client
from groq import Groq

# Load environment variables from .env
load_dotenv()

# ─── Supabase Setup ───
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID")

NGROK_URL = os.getenv("NGROK_URL")
if not NGROK_URL:
    raise ValueError("Missing NGROK_URL in .env")

TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER")

if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
    raise ValueError("Missing Twilio credentials in .env")

if not ELEVENLABS_API_KEY:
    raise ValueError("Missing ELEVENLABS_API_KEY in .env")
if not ELEVENLABS_VOICE_ID:
    raise ValueError("Missing ELEVENLABS_VOICE_ID in .env")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_KEY in .env")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# ─── Groq Setup ───
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

if not GROQ_API_KEY:
    raise ValueError("Missing GROQ_API_KEY in .env")

groq_client = Groq(api_key=GROQ_API_KEY)

# ─── Project Paths ───
PROJECT_ROOT = os.getenv("PROJECT_ROOT")

if not PROJECT_ROOT:
    raise ValueError("Missing PROJECT_ROOT in .env")

RESUMES_DIR = os.path.join(PROJECT_ROOT, "public", "uploads", "resumes")
CACHE_DIR = os.path.join(os.path.dirname(__file__), "resumes_cache")

# ─── Helper: get full path of a resume from its DB path ───
def get_resume_full_path(resume_path: str) -> str:
    """
    resume_path from DB looks like: /uploads/resumes/123_johndoe.pdf
    Returns the full filesystem path to the file.
    """
    relative_path = resume_path.lstrip("/")  # remove leading slash
    return os.path.join(PROJECT_ROOT, "public", relative_path)


# ─── Quick test when run directly ───
if __name__ == "__main__":
    print("Supabase URL:", SUPABASE_URL)
    print("Resumes Dir:", RESUMES_DIR)
    print("Cache Dir:", CACHE_DIR)

    # Test Supabase connection
    try:
        response = supabase.table("jobs").select("id, title").limit(1).execute()
        print("Supabase connection OK. Sample job:", response.data)
    except Exception as e:
        print("Supabase connection FAILED:", e)