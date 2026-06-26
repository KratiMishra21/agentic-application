import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from fastapi import Request
from fastapi.responses import Response
from twilio.rest import Client
from twilio.twiml.voice_response import VoiceResponse, Play, Record, Pause
from config import (
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
    NGROK_URL,
    supabase,
)
from calls.conversation import (
    create_session,
    get_session,
    process_response,
    finalize_call,
)
from calls.transcribe import transcribe_audio_url
from calls.voice import text_to_speech

twilio_client = Client(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)


# ─── Step 1: Initiate call ───

def initiate_call(candidate_id: str) -> dict:
    """
    Fetch candidate details and place a Twilio call.
    Called by POST /call/initiate from HR dashboard.
    """
    try:
        # Fetch candidate
        result = supabase.table("candidates").select(
            "id, name, phone, job_id, status"
        ).eq("id", candidate_id).single().execute()

        candidate = result.data
        if not candidate:
            return {"status": "error", "message": "Candidate not found"}

        if candidate["status"] not in ["shortlisted"]:
            return {
                "status": "error",
                "message": f"Candidate status is '{candidate['status']}' — only shortlisted candidates can be called"
            }

        phone = candidate["phone"].strip()
        # Ensure Indian number format
        if not phone.startswith("+"):
            phone = f"+91{phone}"

        # Twilio calls your webhook when candidate picks up
        call = twilio_client.calls.create(
            to=phone,
            from_=TWILIO_PHONE_NUMBER,
            url=f"{NGROK_URL}/call/webhook?candidate_id={candidate_id}&job_id={candidate['job_id']}",
            status_callback=f"{NGROK_URL}/call/status",
            status_callback_method="POST",
            status_callback_event=["completed", "no-answer", "busy", "failed"],
        )

        # Update candidate status
        supabase.table("candidates").update(
            {"status": "call_initiated"}
        ).eq("id", candidate_id).execute()

        print(f"[call_handler] Call initiated: {call.sid} → {phone}")
        return {"status": "success", "call_sid": call.sid, "to": phone}

    except Exception as e:
        print(f"[call_handler] initiate_call error: {e}")
        return {"status": "error", "message": str(e)}


# ─── Step 2: Twilio webhook — call connected ───

async def handle_webhook(request: Request) -> Response:
    """
    Twilio hits this when the candidate picks up.
    Plays opening message and starts recording consent response.
    """
    params = dict(request.query_params)
    candidate_id = params.get("candidate_id")
    job_id = params.get("job_id")
    call_sid = (await request.form()).get("CallSid", "unknown")

    # Create conversation session
    create_session(call_sid, candidate_id, job_id)

    response = VoiceResponse()

    # Play opening message
    response.play(f"{NGROK_URL}/audio/calls/opening.mp3")

    # Record candidate's consent response
    response.record(
        action=f"{NGROK_URL}/call/recording?call_sid={call_sid}&state=consent",
        method="POST",
        max_length=10,
        timeout=5,
        play_beep=False,
        trim="trim-silence",
    )

    return Response(content=str(response), media_type="application/xml")


# ─── Step 3: Twilio recording callback ───

async def handle_recording(request: Request) -> Response:
    """
    Twilio hits this after each recording with the audio URL.
    Transcribes, processes response, plays next audio.
    """
    form = await request.form()
    params = dict(request.query_params)

    call_sid = params.get("call_sid") or form.get("CallSid")
    recording_url = form.get("RecordingUrl", "")

    if recording_url:
        recording_url += ".wav"

    session = get_session(call_sid)
    if not session:
        response = VoiceResponse()
        response.play(f"{NGROK_URL}/audio/calls/closing.mp3")
        response.hangup()
        return Response(content=str(response), media_type="application/xml")

    # Transcribe what candidate said
    transcribed = ""
    if recording_url:
        import time
        time.sleep(1)  # small delay so Twilio finishes processing
        transcribed = transcribe_audio_url(recording_url)

    if not transcribed:
        transcribed = "unclear"

    # Process through state machine
    action = process_response(call_sid, transcribed)

    response = VoiceResponse()

    if action["action"] == "end_call":
        response.play(f"{NGROK_URL}/audio/calls/{action['audio_file']}.mp3")
        response.pause(length=1)
        response.hangup()
        # Generate and save summary
        finalize_call(call_sid)

    elif action["action"] == "play_audio":
        response.play(f"{NGROK_URL}/audio/calls/{action['audio_file']}.mp3")
        response.record(
            action=f"{NGROK_URL}/call/recording?call_sid={call_sid}",
            method="POST",
            max_length=30,
            timeout=5,
            play_beep=False,
            trim="trim-silence",
        )

    elif action["action"] == "dynamic":
        # Generate fresh audio for dynamic text
        dynamic_text = action["dynamic_text"]
        filename = f"dynamic_{call_sid[:8]}"
        audio_path = text_to_speech(dynamic_text, filename)

        if audio_path:
            response.play(f"{NGROK_URL}{audio_path}")
        else:
            # Fallback to Twilio's built-in TTS if generation fails
            response.say(dynamic_text, voice="alice")

        response.record(
            action=f"{NGROK_URL}/call/recording?call_sid={call_sid}",
            method="POST",
            max_length=30,
            timeout=5,
            play_beep=False,
            trim="trim-silence",
        )

    return Response(content=str(response), media_type="application/xml")


# ─── Step 4: Call status callback ───

async def handle_status(request: Request) -> Response:
    """
    Twilio hits this when call ends with final status.
    Handles no-answer, busy, failed cases.
    """
    form = await request.form()
    call_sid = form.get("CallSid")
    call_status = form.get("CallStatus")

    print(f"[call_handler] Call {call_sid} ended with status: {call_status}")

    if call_status in ["no-answer", "busy", "failed"]:
        # Find candidate by looking up active sessions
        session = get_session(call_sid)
        if session:
            candidate_id = session["candidate_id"]

            # Check attempt count
            result = supabase.table("candidates").select(
                "call_attempts"
            ).eq("id", candidate_id).single().execute()

            attempts = (result.data or {}).get("call_attempts", 0) + 1

            if attempts >= 2:
                new_status = "unreachable"
            else:
                new_status = "shortlisted"  # reset to retry later

            supabase.table("candidates").update({
                "status": new_status,
                "call_attempts": attempts,
            }).eq("id", candidate_id).execute()

            finalize_call(call_sid)

    return Response(content="OK", media_type="text/plain")