import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

import json
import re
from config import supabase, groq_client

# ─── In-memory call sessions ───
# Keyed by Twilio CallSid
# In production this would be Redis — for prototype, memory is fine
_sessions = {}


def create_session(call_sid: str, candidate_id: str, job_id: str):
    """Create a new call session when a call connects."""
    # Fetch candidate info
    candidate = supabase.table("candidates").select(
        "id, name, phone"
    ).eq("id", candidate_id).single().execute().data

    # Fetch job info including custom questions and budget
    job = supabase.table("jobs").select(
        "id, title, questions, budget"
    ).eq("id", job_id).single().execute().data

    # Parse questions from JSON string
    questions = []
    if job and job.get("questions"):
        try:
            questions = json.loads(job["questions"])
        except Exception:
            questions = []

    _sessions[call_sid] = {
        "call_sid": call_sid,
        "candidate_id": candidate_id,
        "candidate_name": candidate.get("name", "Candidate") if candidate else "Candidate",
        "job_id": job_id,
        "job_title": job.get("title", "") if job else "",
        "budget": job.get("budget", 0) if job else 0,
        "questions": questions,
        "current_question_index": 0,
        "state": "consent",           # current state in the conversation flow
        "transcript": [],             # list of {"question": ..., "answer": ...}
        "salary_answer": None,
        "salary_accepted": None,
    }

    print(f"[conversation] Session created for {call_sid} — candidate: {candidate_id}")
    return _sessions[call_sid]


def get_session(call_sid: str) -> dict | None:
    return _sessions.get(call_sid)


def end_session(call_sid: str):
    """Remove session from memory after call ends."""
    if call_sid in _sessions:
        del _sessions[call_sid]
        print(f"[conversation] Session ended: {call_sid}")


# ─── State machine ───
# States: consent → salary → salary_negotiation → hr_questions → closing → done

def process_response(call_sid: str, transcribed_text: str) -> dict:
    """
    Process candidate's transcribed response and return next action.

    Returns dict:
    {
        "action": "play_audio" | "end_call",
        "audio_file": "filename_without_extension",
        "dynamic_text": "text to generate audio for dynamically" (optional),
        "state": "new state name"
    }
    """
    session = get_session(call_sid)
    if not session:
        return {"action": "end_call", "audio_file": "closing"}

    state = session["state"]
    text = transcribed_text.lower().strip()

    print(f"[conversation] State: {state} | Response: {transcribed_text}")

    # ── STATE: consent ──
    if state == "consent":
        if _is_yes(text):
            session["state"] = "salary"
            session["transcript"].append({
                "question": "Do you consent to proceed?",
                "answer": transcribed_text
            })
            return {"action": "play_audio", "audio_file": "salary_question", "state": "salary"}
        else:
            session["state"] = "done"
            session["transcript"].append({
                "question": "Do you consent to proceed?",
                "answer": transcribed_text
            })
            return {"action": "end_call", "audio_file": "consent_declined", "state": "done"}

    # ── STATE: salary ──
    elif state == "salary":
        salary = _extract_salary(transcribed_text)
        session["salary_answer"] = salary
        session["transcript"].append({
            "question": "What is your expected annual salary in lakhs?",
            "answer": transcribed_text
        })

        budget = session["budget"]
        print(f"[DEBUG] salary={salary} type={type(salary)} | budget={budget} type={type(budget)}")

        if salary and budget and salary <= budget:
            # Salary within budget — proceed to HR questions
            session["state"] = "hr_questions"
            session["salary_accepted"] = True
            return {
                "action": "play_audio",
                "audio_file": "transition_to_hr",
                "state": "hr_questions"
            }
        elif salary and budget and salary > budget:
            # Salary over budget — negotiate
            session["state"] = "salary_negotiation"
            return {
                "action": "play_audio",
                "audio_file": "salary_over_budget",
                "state": "salary_negotiation"
            }
        else:
            # Could not extract salary — ask again
            return {
                "action": "dynamic",
                "dynamic_text": "I'm sorry, I didn't catch that. Could you please tell me your expected annual salary in lakhs?",
                "state": "salary"
            }

    # ── STATE: salary_negotiation ──
    elif state == "salary_negotiation":
        session["transcript"].append({
            "question": "Would you be open to the company budget?",
            "answer": transcribed_text
        })

        if _is_yes(text):
            session["state"] = "hr_questions"
            session["salary_accepted"] = True
            return {
                "action": "play_audio",
                "audio_file": "transition_to_hr",
                "state": "hr_questions"
            }
        else:
            session["state"] = "done"
            session["salary_accepted"] = False
            _update_candidate_status(session, "rejected")
            return {
                "action": "end_call",
                "audio_file": "salary_rejected",
                "state": "done"
            }

    # ── STATE: hr_questions ──
    elif state == "hr_questions":
        questions = session["questions"]
        idx = session["current_question_index"]

        # Save answer to previous question if there was one
        if idx > 0 and idx <= len(questions):
            session["transcript"].append({
                "question": questions[idx - 1],
                "answer": transcribed_text
            })

        # Check if more questions remain
        if idx < len(questions):
            session["current_question_index"] += 1
            return {
                "action": "dynamic",
                "dynamic_text": questions[idx],
                "state": "hr_questions"
            }
        else:
            # All questions done
            session["state"] = "closing"
            return {
                "action": "end_call",
                "audio_file": "closing",
                "state": "done"
            }

    return {"action": "end_call", "audio_file": "closing", "state": "done"}


def finalize_call(call_sid: str):
    """
    Called when call ends. Generates summary and updates Supabase.
    """
    session = get_session(call_sid)
    if not session:
        return

    transcript = session["transcript"]
    if not transcript:
        end_session(call_sid)
        return

    summary = _generate_summary(session)
    _save_summary(session, summary)
    end_session(call_sid)


# ─── Helpers ───

def _is_yes(text: str) -> bool:
    """Detect affirmative responses."""
    yes_words = ["yes", "yeah", "yep", "sure", "okay", "ok",
                 "absolutely", "definitely", "of course", "agree",
                 "proceed", "happy to", "fine", "alright"]
    return any(w in text for w in yes_words)


def _extract_salary(text: str) -> int | None:
    """
    Extract salary number from candidate's response.
    Handles: '50000', '50k', '5 lakhs', '5 lakh', '1.5 lakh'
    Returns annual salary as integer or None.
    """
    text = text.lower().replace(",", "")

    # Match lakh patterns first
    lakh_match = re.search(r"(\d+\.?\d*)\s*lakh", text)
    if lakh_match:
        val = float(lakh_match.group(1))
        return int(val * 100000)

    # Match 'k' suffix
    k_match = re.search(r"(\d+)\s*k", text)
    if k_match:
        return int(k_match.group(1)) * 1000

    # Match plain number
    num_match = re.search(r"\b(\d{4,7})\b", text)
    if num_match:
        return int(num_match.group(1))

    # Ask Groq to extract if regex fails
    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[{
                "role": "user",
                "content": f"Extract the annual salary in INR as a plain integer from: '{text}'. Return only the number, nothing else. If you cannot find a number return 0."
            }],
            max_tokens=20,
            temperature=0,
        )
        val = int(response.choices[0].message.content.strip())
        return val if val > 0 else None
    except Exception:
        return None


def _generate_summary(session: dict) -> str:
    """Generate structured summary using Groq."""
    transcript_text = "\n".join([
        f"Q: {item['question']}\nA: {item['answer']}"
        for item in session["transcript"]
    ])

    prompt = f"""You are a senior HR interviewer writing a professional candidate evaluation report.

Candidate Name: {session['candidate_name']}
Position Applied For: {session['job_title']}
Annual Salary Expected: ₹{session.get('salary_answer', 'Not provided'):,}
Salary Within Budget: {'Yes' if session.get('salary_accepted') else 'No'}

Interview Transcript:
{transcript_text}

Write a detailed, professional candidate evaluation report with the following sections. Each section must be a well-written paragraph of 3-4 sentences. Do not use bullet points. Write in third person (refer to the candidate by name).

**Salary & Compensation Alignment**
Discuss the candidate's salary expectation, whether it aligns with the allocated budget, and any negotiation context if applicable.

**Interview Performance & Key Responses**
Summarize how the candidate responded to each question. Highlight specific answers they gave, quoting or paraphrasing their actual responses from the transcript. Evaluate the depth and relevance of their answers.

**Motivation & Career Trajectory**
Assess the candidate's reason for leaving their current role, their stated career goals, and whether their ambitions align with what this position offers.

**Communication & Professionalism**
Evaluate the clarity, confidence, and professionalism of the candidate's communication throughout the interview. Note any standout moments or concerns.

**Overall Recommendation**
Provide a clear hiring recommendation with justification based on all of the above. State whether the candidate should be moved to the next round, put on hold, or rejected, and why.

Write only the report. No preamble, no thinking tags, no meta-commentary. Output must be clean professional text only."""

    try:
        response = groq_client.chat.completions.create(
            model="qwen/qwen3.6-27b",
            messages=[
                {"role": "system", "content": "You are a professional HR assistant."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=600,
            temperature=0.3,
            extra_body={"reasoning_effort": "none"}
        )
        summary = response.choices[0].message.content.strip()
        # Strip Qwen thinking tags
        summary = re.sub(r'<think>.*?</think>', '', summary, flags=re.DOTALL).strip()
        return summary
    except Exception as e:
        print(f"[conversation] Summary generation failed: {e}")
        return "Summary could not be generated."


def _update_candidate_status(session: dict, status: str):
    """Update candidate status in Supabase."""
    try:
        supabase.table("candidates").update(
            {"status": status}
        ).eq("id", session["candidate_id"]).execute()
    except Exception as e:
        print(f"[conversation] Failed to update status: {e}")


def _save_summary(session: dict, summary: str):
    """Save call summary and update final status in Supabase."""
    try:
        salary_accepted = session.get("salary_accepted")
        final_status = "interviewed" if salary_accepted else "rejected"

        supabase.table("candidates").update({
            "status": final_status,
            "call_summary": summary,
        }).eq("id", session["candidate_id"]).execute()

        print(f"[conversation] Summary saved for candidate {session['candidate_id']}")
    except Exception as e:
        print(f"[conversation] Failed to save summary: {e}")