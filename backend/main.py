import requests as http_requests
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
import pytz
from fastapi.staticfiles import StaticFiles
import sys, os
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from calls.call_handler import (
    initiate_call,
    handle_webhook,
    handle_recording,
    handle_status,
)

# ─── App Setup ───
app = FastAPI(
    title="Agentic HR Backend",
    description="FastAPI backend for RAG pipeline, call automation, and AI screening",
    version="1.0.0"
)
audio_path = os.path.join(os.path.dirname(__file__), '..', 'public', 'audio')
app.mount("/audio", StaticFiles(directory=audio_path), name="audio")

# ─── CORS — allow Next.js frontend to talk to this server ───
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Next.js dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

IST = pytz.timezone("Asia/Kolkata")

TIME_SLOTS = {
    "morning":   (9, 12),
    "afternoon": (12, 16),
    "evening":   (16, 19),
}


def dispatch_scheduled_calls():
    """Runs every 15 minutes — calls shortlisted candidates at their preferred time."""
    try:
        from config import supabase

        now = datetime.now(IST)
        current_hour = now.hour
        today = now.date().isoformat()

        print(f"[scheduler] Checking for calls at {now.strftime('%H:%M')} IST")

        result = supabase.table("candidates").select(
            "id, name, phone, preferred_call_date, preferred_call_time"
        ).eq("status", "shortlisted").eq("preferred_call_date", today).execute()

        candidates = result.data or []
        print(f"[scheduler] Found {len(candidates)} shortlisted candidate(s) for today")

        for candidate in candidates:
            slot = candidate.get("preferred_call_time") or "morning"
            start_hour, end_hour = TIME_SLOTS.get(slot, (9, 17))

            if not (start_hour <= current_hour < end_hour):
                continue

            candidate_id = candidate.get("id")
            print(f"[scheduler] Initiating call for candidate {candidate_id} ({candidate.get('name')})")
            initiate_call(candidate_id)

    except Exception as e:
        print(f"[scheduler] error: {e}")


scheduler = BackgroundScheduler(timezone=IST)
scheduler.add_job(
    dispatch_scheduled_calls,
    "interval",
    minutes=15,
    id="scheduled_call_dispatcher",
    replace_existing=True,
)

if not scheduler.running:
    scheduler.start()

# ─── Routes ───

@app.get("/")
def root():
    return {"status": "Agentic HR backend is running"}


@app.post("/shortlist")
def shortlist(job_id: str | None = None):
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'rag'))  # add this line
        from rag.run_pipeline import run
        run(job_id)
        return {"status": "success", "message": f"Pipeline completed for job_id: {job_id or 'all'}"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/candidates")
def get_candidates(job_id: str | None = None):
    """
    Fetch all candidates with their match scores and statuses.
    Optionally filter by job_id.
    """
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from config import supabase

        query = supabase.table("candidates").select(
            "id, name, email, phone, status, match_score, created_at, resume_path, job_id, jobs(title)"
        ).order("match_score", ascending=False)

        if job_id:
            query = query.eq("job_id", job_id)

        response = query.execute()

        candidates = [
            {
                "id": c["id"],
                "name": c["name"],
                "email": c["email"],
                "phone": c["phone"],
                "status": c["status"],
                "match_score": c["match_score"],
                "created_at": c["created_at"],
                "resume_path": c["resume_path"],
                "job_id": c["job_id"],
                "job_title": c.get("jobs", {}).get("title") if c.get("jobs") else None,
            }
            for c in (response.data or [])
        ]

        return {"status": "success", "candidates": candidates}

    except Exception as e:
        return {"status": "error", "message": str(e)}


@app.get("/jobs")
def get_jobs():
    """Fetch all jobs — used by frontend dropdowns."""
    try:
        sys.path.insert(0, os.path.dirname(__file__))
        from config import supabase

        response = supabase.table("jobs").select("id, title").execute()
        return {"status": "success", "jobs": response.data or []}

    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/scheduler/trigger")
def trigger_scheduler():
    dispatch_scheduled_calls()
    return {"status": "triggered"}

@app.post("/pregenerate-questions")
def pregenerate_questions(payload: dict):
    from calls.voice import generate_question_audio
    job_id = payload.get("job_id")
    questions = payload.get("questions", [])
    for i, question in enumerate(questions):
        generate_question_audio(question, f"{job_id[:8]}_{i}")
    return {"status": "success", "generated": len(questions)}


@app.post("/call/initiate")
def call_initiate(candidate_id: str):
    return initiate_call(candidate_id)

@app.post("/call/webhook")
async def call_webhook(request: Request):
    return await handle_webhook(request)

@app.post("/call/recording")
async def call_recording(request: Request):
    return await handle_recording(request)

@app.post("/call/status")
async def call_status(request: Request):
    return await handle_status(request)