"""
evaluate_pipeline_v3.py
-----------------------
Fixes from v2:
1. Saves results to CSV incrementally (every 10 resumes) so progress is never lost
2. Skips LLM verdict if --skip_llm flag is passed (avoids Groq rate limits)
3. Resumes from where it left off if output CSV already exists (--resume mode)
4. Catches KeyboardInterrupt gracefully and saves whatever was collected
"""

import sys, os, time, csv, argparse, io, re
sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "rag"))

import fitz
import pytesseract
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"
from PIL import Image

from rag.embeddings import (
    embed_text, chunk_resume_text, embed_texts,
    _detect_section, cosine_similarity,
    SECTION_WEIGHTS, DEFAULT_SECTION_WEIGHT,
)
from rag.shortlist import get_llm_verdict, SIMILARITY_THRESHOLD

# ─── JOB DESCRIPTIONS ─────────────────────────────────────────────────────────
JOBS = [
    ("JD01","Software Engineer (Backend)",
     "We are looking for a Backend Software Engineer to build reliable, scalable backend systems. Design RESTful APIs, implement business logic, optimize database performance. Strong foundation in data structures, algorithms, distributed systems required.",
     "Python, FastAPI, PostgreSQL, REST API, distributed systems, Docker"),
    ("JD02","Data Analyst",
     "Seeking a Data Analyst to transform datasets into insights. Collect, clean, validate, analyze data, create dashboards and reports, provide data-driven recommendations.",
     "SQL, Python, Tableau, PowerBI, statistics, data visualization, Excel"),
    ("JD03","Machine Learning Engineer",
     "Hiring a Machine Learning Engineer to develop end-to-end ML pipelines, preprocess datasets, train and deploy ML and deep learning models. MLOps, cloud platforms, production AI systems experience required.",
     "Python, TensorFlow, PyTorch, scikit-learn, MLOps, deep learning, NLP, cloud"),
    ("JD04","Frontend Developer",
     "Looking for a Frontend Developer to create responsive web applications. Implement interfaces using modern JS frameworks, integrate APIs, optimize performance.",
     "React, JavaScript, TypeScript, HTML, CSS, Next.js, REST API, responsive design"),
    ("JD05","Full Stack Developer",
     "Seeking a Full Stack Developer to build end-to-end web applications. Design UIs, develop backend services, manage databases, deploy to cloud platforms.",
     "React, Node.js, Python, PostgreSQL, AWS, Docker, REST API, Git"),
    ("JD06","DevOps Engineer",
     "Looking for a DevOps Engineer to streamline deployment pipelines, manage cloud infrastructure, automate deployments, monitor system performance.",
     "Kubernetes, Docker, Terraform, AWS, CI/CD, Jenkins, Linux, monitoring"),
    ("JD07","UI/UX Designer",
     "Seeking a UI/UX Designer to design digital experiences. Conduct user research, create wireframes, prototypes, and high-fidelity designs.",
     "Figma, Adobe XD, wireframing, prototyping, user research, design systems"),
    ("JD08","Cybersecurity Analyst",
     "Hiring a Cybersecurity Analyst to protect digital infrastructure. Monitor security events, investigate incidents, perform vulnerability assessments.",
     "SIEM, penetration testing, vulnerability assessment, compliance, firewall, incident response"),
    ("JD09","Business Analyst",
     "Looking for a Business Analyst to bridge business and technical solutions. Gather requirements, identify process improvements, translate business goals into specs.",
     "requirements gathering, stakeholder management, JIRA, Agile, process analysis, SQL"),
    ("JD10","Cloud Engineer",
     "Seeking a Cloud Engineer to design and maintain cloud infrastructure. Automate provisioning, optimize resources, implement monitoring, support deployments.",
     "AWS, Azure, GCP, Terraform, Kubernetes, cloud security, Infrastructure as Code"),
]

FIELDNAMES = [
    "filename", "job_id", "job_title", "char_count", "chunk_count",
    "unique_sections", "used_fallback_chunker",
    "weighted_score", "uniform_score", "bm25_score", "dense_only_score",
    "score_delta", "weighted_best_section",
    "weighted_shortlisted", "uniform_shortlisted", "bm25_shortlisted",
    "dense_only_shortlisted", "decision_changed_by_weighting",
    "sim_only_decision", "two_stage_decision", "llm_overrode_similarity",
    "llm_reasoning_snippet",
    "latency_extraction_s", "latency_chunking_s", "latency_embedding_s",
    "latency_similarity_s", "latency_llm_s", "latency_total_s",
]

# ─── TEXT EXTRACTION ──────────────────────────────────────────────────────────

def extract_text_from_pdf(pdf_path):
    try:
        doc = fitz.open(pdf_path)
        text = "".join(page.get_text() for page in doc)
        if len(text.strip()) >= 50:
            return text.strip()
        # OCR fallback
        text = ""
        for page in doc:
            mat = fitz.Matrix(200/72, 200/72)
            pix = page.get_pixmap(matrix=mat)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            text += pytesseract.image_to_string(img) + "\n"
        return text.strip()
    except Exception as e:
        print(f"  [ERROR] {e}")
        return ""

# ─── HELPERS ──────────────────────────────────────────────────────────────────

def build_jd_text(desc, kw):
    return f"{desc.strip()}\n\nKey skills required: {kw.strip()}"

def max_similarity_weighted(jd_emb, records):
    best, sec = -1.0, "unknown"
    for r in records:
        s = cosine_similarity(jd_emb, r["embedding"]) * SECTION_WEIGHTS.get(r["section"], DEFAULT_SECTION_WEIGHT)
        if s > best: best, sec = s, r["section"]
    return max(best, 0.0), sec

def max_similarity_uniform(jd_emb, records):
    best, sec = -1.0, "unknown"
    for r in records:
        s = cosine_similarity(jd_emb, r["embedding"])
        if s > best: best, sec = s, r["section"]
    return max(best, 0.0), sec

def bm25_score(jd_text: str, resume_text: str) -> float:
    """Simple BM25 scoring — no embeddings, just term frequency."""
    import math

    def tokenize(text):
        return re.findall(r'\b\w+\b', text.lower())

    jd_tokens = set(tokenize(jd_text))
    resume_tokens = tokenize(resume_text)
    resume_len = len(resume_tokens)
    avg_len = 300
    k1, b = 1.5, 0.75

    score = 0.0
    token_freq = {}
    for t in resume_tokens:
        token_freq[t] = token_freq.get(t, 0) + 1

    for term in jd_tokens:
        if term in token_freq:
            tf = token_freq[term]
            idf = math.log(2)
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * resume_len / avg_len)
            score += idf * (numerator / denominator)

    return min(score / (len(jd_tokens) + 1), 1.0)

def max_similarity_dense_only(jd_emb, resume_text: str) -> float:
    """Baseline: embed full resume as single vector, no chunking."""
    full_emb = embed_text(resume_text[:4000])
    return max(cosine_similarity(jd_emb, full_emb), 0.0)

def assign_best_jd(records):
    best_score, best_job = -1.0, JOBS[0]
    for job in JOBS:
        jd_emb = embed_text(build_jd_text(job[2], job[3]))
        score, _ = max_similarity_uniform(jd_emb, records)
        if score > best_score:
            best_score, best_job = score, job
    return best_job

def write_csv(results, output_csv, mode="w"):
    with open(output_csv, mode, newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if mode == "w":
            writer.writeheader()
        writer.writerows(results)

def already_processed(output_csv):
    """Return set of filenames already in the CSV (for resume mode)."""
    if not os.path.exists(output_csv):
        return set()
    with open(output_csv, encoding="utf-8") as f:
        reader = csv.DictReader(f)
        return {row["filename"] for row in reader}

# ─── MAIN ─────────────────────────────────────────────────────────────────────

def run_evaluation(resume_dir, output_csv, min_chars=800, skip_llm=False, save_every=10):
    pdf_files = sorted([
        os.path.join(resume_dir, f)
        for f in os.listdir(resume_dir)
        if f.lower().endswith(".pdf")
    ])
    print(f"\nFound {len(pdf_files)} PDF files")

    # Resume from where we left off
    done = already_processed(output_csv)
    if done:
        print(f"Resuming — {len(done)} already processed, skipping them")

    # If resuming, open CSV in append mode; else fresh write
    first_write = not bool(done)
    results_buffer = []
    all_results = []
    skipped = 0
    total_processed = len(done)

    try:
        for i, pdf_path in enumerate(pdf_files):
            fname = os.path.basename(pdf_path)

            # Skip already done
            if fname in done:
                continue

            print(f"\n[{i+1}/{len(pdf_files)}] {fname}")

            # Extract
            t0 = time.time()
            resume_text = extract_text_from_pdf(pdf_path)
            t_extract = round(time.time() - t0, 3)

            if len(resume_text) < min_chars:
                print(f"  SKIP — {len(resume_text)} chars")
                skipped += 1
                continue

            # Chunk
            t1 = time.time()
            chunks = chunk_resume_text(resume_text)
            t_chunk = round(time.time() - t1, 4)
            if not chunks:
                skipped += 1
                continue

            sections = [_detect_section(c) for c in chunks]
            used_fallback = all(s == "unknown" for s in sections)

            # Embed
            t2 = time.time()
            embs = embed_texts(chunks)
            t_embed = round(time.time() - t2, 3)
            records = [{"embedding": e, "section": _detect_section(c)} for c, e in zip(chunks, embs)]

            # Assign JD
            job = assign_best_jd(records)
            job_id, job_title, jd_desc, jd_kw = job
            jd_text = build_jd_text(jd_desc, jd_kw)
            print(f"  → {job_title} | Chars: {len(resume_text)} | Chunks: {len(chunks)} | Fallback: {used_fallback}")

            jd_emb = embed_text(jd_text)

            # Weighted vs Uniform
            t4a = time.time()
            w_score, w_sec = max_similarity_weighted(jd_emb, records)
            t_weighted = round(time.time() - t4a, 4)

            u_score, u_sec = max_similarity_uniform(jd_emb, records)

            w_short = w_score >= SIMILARITY_THRESHOLD
            u_short = u_score >= SIMILARITY_THRESHOLD
            changed = w_short != u_short

            print(f"  Weighted: {w_score:.4f} ({w_sec}) → {'✓ SHORTLIST' if w_short else '✗ REJECT'}")
            print(f"  Uniform:  {u_score:.4f} ({u_sec}) → {'✓ SHORTLIST' if u_short else '✗ REJECT'}")

            # BM25 score
            bm25 = bm25_score(jd_text, resume_text)
            bm25_shortlisted = bm25 >= SIMILARITY_THRESHOLD

            # Dense-only (no chunking)
            dense_score = max_similarity_dense_only(jd_emb, resume_text)
            dense_shortlisted = dense_score >= SIMILARITY_THRESHOLD

            print(f"  BM25:     {bm25:.4f} → {'✓ SHORTLIST' if bm25_shortlisted else '✗ REJECT'}")
            print(f"  Dense-only: {dense_score:.4f} → {'✓ SHORTLIST' if dense_shortlisted else '✗ REJECT'}")
            if changed:
                print(f"  *** DECISION FLIPPED ***")

            # LLM verdict (skippable)
            t5 = time.time()
            if skip_llm:
                llm_status = "skipped"
                llm_reasoning = ""
            else:
                try:
                    verdict = get_llm_verdict(jd_text, resume_text, w_score, threshold=SIMILARITY_THRESHOLD)
                    llm_status = verdict.get("status", "error")
                    llm_reasoning = verdict.get("reasoning", "")[:120]
                except Exception as e:
                    llm_status = "error"
                    llm_reasoning = str(e)[:120]
                    print(f"  [LLM error] {llm_reasoning[:80]}")
            t_llm = round(time.time() - t5, 3)

            sim_only = "shortlisted" if w_short else "rejected"
            llm_overrode = (llm_status not in ("skipped", "error")) and (sim_only != llm_status)

            t_total = round(t_extract + t_chunk + t_embed + t_weighted + t_llm, 3)
            print(f"  Latency: extract={t_extract}s embed={t_embed}s sim={t_weighted}s llm={t_llm}s total={t_total}s")

            result_row = {
                "filename": fname,
                "job_id": job_id,
                "job_title": job_title,
                "char_count": len(resume_text),
                "chunk_count": len(chunks),
                "unique_sections": "|".join(set(sections)),
                "used_fallback_chunker": used_fallback,
                "weighted_score": round(w_score, 4),
                "uniform_score": round(u_score, 4),
                "bm25_score": round(bm25, 4),
                "dense_only_score": round(dense_score, 4),
                "score_delta": round(w_score - u_score, 4),
                "weighted_best_section": w_sec,
                "weighted_shortlisted": w_short,
                "uniform_shortlisted": u_short,
                "bm25_shortlisted": bm25_shortlisted,
                "dense_only_shortlisted": dense_shortlisted,
                "decision_changed_by_weighting": changed,
                "sim_only_decision": sim_only,
                "two_stage_decision": llm_status,
                "llm_overrode_similarity": llm_overrode,
                "llm_reasoning_snippet": llm_reasoning,
                "latency_extraction_s": t_extract,
                "latency_chunking_s": t_chunk,
                "latency_embedding_s": t_embed,
                "latency_similarity_s": t_weighted,
                "latency_llm_s": t_llm,
                "latency_total_s": t_total,
            }
            results_buffer.append(result_row)
            all_results.append(result_row)
            total_processed += 1

            # Save every N resumes so progress is never lost
            if len(results_buffer) >= save_every:
                mode = "w" if first_write else "a"
                write_csv(results_buffer, output_csv, mode=mode)
                first_write = False
                print(f"  [Saved {total_processed} results so far → {output_csv}]")
                results_buffer = []

    except KeyboardInterrupt:
        print(f"\n\n⚠️  Interrupted! Saving {len(results_buffer)} buffered results...")

    # Save any remaining
    if results_buffer:
        mode = "w" if first_write else "a"
        write_csv(results_buffer, output_csv, mode=mode)
        print(f"✅ Saved → {output_csv}")

    if all_results:
        n = len(all_results)
        avg_bm25 = sum(r["bm25_score"] for r in all_results) / n
        avg_dense = sum(r["dense_only_score"] for r in all_results) / n
        shortlisted_bm25 = sum(1 for r in all_results if r["bm25_shortlisted"])
        shortlisted_dense = sum(1 for r in all_results if r["dense_only_shortlisted"])

        print(f"BM25 shortlist rate: {shortlisted_bm25}/{n} ({100*shortlisted_bm25/n:.1f}%) | Avg score: {avg_bm25:.4f}")
        print(f"Dense-only shortlist rate: {shortlisted_dense}/{n} ({100*shortlisted_dense/n:.1f}%) | Avg score: {avg_dense:.4f}")

    print(f"\nDone. Total processed this run: {total_processed} | Skipped: {skipped}")
    print(f"To resume later, just run the same command again — already-done files are skipped automatically.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--resume_dir", default="./eval_resumes")
    parser.add_argument("--output", default="eval_results.csv")
    parser.add_argument("--min_chars", type=int, default=800)
    parser.add_argument("--skip_llm", action="store_true",
                        help="Skip LLM verdict calls (avoids Groq rate limits)")
    parser.add_argument("--save_every", type=int, default=10,
                        help="Save to CSV every N resumes (default: 10)")
    args = parser.parse_args()
    run_evaluation(args.resume_dir, args.output, args.min_chars, args.skip_llm, args.save_every)