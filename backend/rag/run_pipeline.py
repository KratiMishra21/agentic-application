import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
sys.path.insert(0, os.path.dirname(__file__))

from config import supabase
from extract_text import extract_text_from_pdf
from embeddings import (
    embed_text,
    upsert_resume_chunks,
    get_resume_chunk_embeddings,
    upsert_job_embedding,
    get_job_embedding,
    cosine_similarity,
    max_similarity_to_chunks,
)
from shortlist import get_llm_verdict, SIMILARITY_THRESHOLD

def fetch_candidates(job_id: str | None = None):
    query = supabase.table("candidates").select("id, job_id, resume_path")
    
    if job_id:
        query = query.eq("job_id", job_id)
    
    # Only process pending candidates
    query = query.eq("status", "pending")
    
    response = query.execute()
    return response.data or []


def fetch_job(job_id: str):
    """Fetch a single job's description, title, and keywords by id."""
    response = (
        supabase.table("jobs")
        .select("id, title, description, keywords")
        .eq("id", job_id)
        .limit(1)
        .execute()
    )
    data = response.data or []
    return data[0] if data else None


def build_jd_text(job: dict) -> str:
    """Combine job description and keywords into a single text block for embedding/scoring."""
    description = (job.get("description") or "").strip()
    keywords = (job.get("keywords") or "").strip()

    jd_text = description
    if keywords:
        jd_text += f"\n\nKey skills required: {keywords}"

    return jd_text.strip()


def update_candidate(candidate_id: str, match_score: float, status: str):
    """Write match_score and status back to the candidates row."""
    supabase.table("candidates").update(
        {
            "match_score": round(match_score, 4),
            "status": status,
        }
    ).eq("id", candidate_id).execute()


def process_candidate(candidate: dict, job_cache: dict):
    candidate_id = candidate["id"]
    job_id = candidate["job_id"]
    resume_path = candidate["resume_path"]

    print(f"\n--- Processing candidate {candidate_id} (job {job_id}) ---")

    if not resume_path:
        print(f"[run_pipeline] No resume_path for candidate {candidate_id}, skipping.")
        update_candidate(candidate_id, 0.0, "error")
        return

    if not job_id:
        print(f"[run_pipeline] No job_id for candidate {candidate_id}, skipping.")
        update_candidate(candidate_id, 0.0, "error")
        return

    # 1. Text extraction
    resume_text = extract_text_from_pdf(resume_path)
    if not resume_text:
        print(f"[run_pipeline] No text extracted for candidate {candidate_id}, skipping.")
        update_candidate(candidate_id, 0.0, "error")
        return

    # 2. Fetch / cache job description
    if job_id not in job_cache:
        job = fetch_job(job_id)
        if not job:
            print(f"[run_pipeline] Job {job_id} not found, skipping candidate {candidate_id}.")
            return
        job_cache[job_id] = job

    job = job_cache[job_id]
    jd_text = build_jd_text(job)

    if not jd_text:
        print(f"[run_pipeline] Empty JD for job {job_id}, skipping candidate {candidate_id}.")
        update_candidate(candidate_id, 0.0, "error")
        return

    # 2b. Embedding generation
    upsert_job_embedding(job_id, jd_text, metadata={"title": job.get("title", "")})
    jd_embedding = embed_text(jd_text)

    # Chunk + embed resume (by section), store in ChromaDB
    upsert_resume_chunks(candidate_id, resume_text, metadata={"job_id": str(job_id)})
    chunk_records = get_resume_chunk_embeddings(candidate_id)

    # 3. Similarity scoring — weighted max similarity across resume chunks
    similarity_score, best_chunk, best_section = max_similarity_to_chunks(jd_embedding, chunk_records)
    print(f"Max weighted similarity: {similarity_score:.4f} (threshold: {SIMILARITY_THRESHOLD}, section: {best_section})")
    if best_chunk:
        preview = best_chunk[:150].replace("\n", " ")
        print(f"Best matching section content: {preview}...")

    # 4. LLM verdict
    verdict = get_llm_verdict(jd_text, resume_text, similarity_score, threshold=SIMILARITY_THRESHOLD)
    print(f"Verdict: {verdict['status']} — {verdict['reasoning']}")

    # 5. Update Supabase (only match_score + status columns exist)
   # 5. Update Supabase
    update_candidate(
        candidate_id=candidate_id,
        match_score=similarity_score,
        status=verdict["status"],
    )

    # 6. If shortlisted, just log — scheduler will call at preferred time
    if verdict["status"] == "shortlisted":
        print(f"[run_pipeline] Candidate {candidate_id} shortlisted — call will be scheduled based on preferred time.")
def run(job_id: str | None = None):
    candidates = fetch_candidates(job_id)
    print(f"Found {len(candidates)} candidate(s) to process.")

    job_cache = {}

    for candidate in candidates:
        try:
            process_candidate(candidate, job_cache)
        except Exception as e:
            print(f"[run_pipeline] Error processing candidate {candidate.get('id')}: {e}")


if __name__ == "__main__":
    import sys
    job_id_arg = sys.argv[1] if len(sys.argv) > 1 else None
    run(job_id_arg)