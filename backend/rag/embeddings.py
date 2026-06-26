import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import hashlib
import re
import chromadb
import chromadb.utils.embedding_functions as ef
from config import CACHE_DIR

# ─── ChromaDB Setup ───
CHROMA_DIR = os.path.join(os.path.dirname(__file__), "chroma_db")
os.makedirs(CHROMA_DIR, exist_ok=True)

chroma_client = chromadb.PersistentClient(path=CHROMA_DIR)

resume_collection = chroma_client.get_or_create_collection(name="resume_chunks")
job_collection = chroma_client.get_or_create_collection(name="jobs")

# ─── Embedding Model ───
_model = ef.DefaultEmbeddingFunction()


def embed_text(text: str) -> list[float]:
    if not text or not text.strip():
        return []
    result = _model([text])
    return result[0]

def embed_texts(texts: list[str]) -> list[list[float]]:
    texts = [t for t in texts if t and t.strip()]
    if not texts:
        return []
    return list(_model(texts))

# ─── Resume Chunking ───

SECTION_HEADERS = [
    "education", "experience", "work experience", "projects",
    "technical skills", "skills", "certifications", "summary",
    "objective", "publications", "achievements", "extracurricular",
]

_HEADER_PATTERN = re.compile(
    r"^(?:" + "|".join(re.escape(h) for h in SECTION_HEADERS) + r")\s*:?\s*$",
    re.IGNORECASE,
)

# ─── Section weighting ───
# Down-weights sections that have generic language and shouldn't
# dominate the match score for most technical/professional roles.
# A section's similarity score is multiplied by its weight before
# being compared in max_similarity_to_chunks.
DEFAULT_SECTION_WEIGHT = 1.0

SECTION_WEIGHTS = {
    "education": 0.6,
    "experience": 1.0,
    "work experience": 1.0,
    "projects": 1.0,
    "skills": 1.0,
    "technical skills": 1.0,
    "certifications": 0.7,
    "summary": 0.8,
    "objective": 0.6,
    "publications": 0.7,
    "achievements": 0.8,
    "extracurricular": 0.5,
}


def _detect_section(chunk_text: str) -> str:
    """
    Detect which section a chunk belongs to, based on its first line.
    Returns the lowercase section name, or 'unknown' if not recognized.
    """
    first_line = chunk_text.strip().splitlines()[0].strip().lower().rstrip(":")
    for header in SECTION_HEADERS:
        if first_line == header:
            return header
    return "unknown"


def chunk_resume_text(resume_text: str, min_chunk_len: int = 40) -> list[str]:
    """
    Split resume text into chunks by section headers.

    Falls back to paragraph-based chunking if no recognizable
    section headers are found.

    Args:
        resume_text: cleaned resume text (one line per logical line)
        min_chunk_len: minimum character length for a chunk to be kept

    Returns:
        List of non-empty text chunks.
    """
    if not resume_text or not resume_text.strip():
        return []

    lines = resume_text.splitlines()

    chunks = []
    current_chunk_lines = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue

        if _HEADER_PATTERN.match(stripped):
            if current_chunk_lines:
                chunk_text = "\n".join(current_chunk_lines).strip()
                if len(chunk_text) >= min_chunk_len:
                    chunks.append(chunk_text)
            current_chunk_lines = [stripped]
        else:
            current_chunk_lines.append(stripped)

    if current_chunk_lines:
        chunk_text = "\n".join(current_chunk_lines).strip()
        if len(chunk_text) >= min_chunk_len:
            chunks.append(chunk_text)

    # Fallback: no headers detected, chunk by fixed-size paragraphs
    if len(chunks) <= 1:
        chunks = _fallback_chunk(resume_text, chunk_size=400)

    return chunks


def _fallback_chunk(text: str, chunk_size: int = 400) -> list[str]:
    """Split text into roughly chunk_size-character chunks on line boundaries."""
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    chunks = []
    current = []
    current_len = 0

    for line in lines:
        current.append(line)
        current_len += len(line)
        if current_len >= chunk_size:
            chunks.append("\n".join(current))
            current = []
            current_len = 0

    if current:
        chunks.append("\n".join(current))

    return chunks if chunks else ([text.strip()] if text.strip() else [])


# ─── Upsert / Fetch ───

def _hash_id(text: str) -> str:
    return hashlib.md5(text.encode("utf-8")).hexdigest()


def upsert_resume_chunks(candidate_id: str, resume_text: str, metadata: dict | None = None):
    """
    Chunk a resume, embed each chunk, and store them in ChromaDB
    keyed by candidate_id + chunk index. Each chunk's detected
    section name is stored in its metadata for weighting at query time.

    Existing chunks for this candidate are deleted first to avoid
    stale leftovers if chunk count changes between runs.
    """
    try:
        existing = resume_collection.get(
            where={"candidate_id": str(candidate_id)},
            include=[],
        )
        if existing["ids"]:
            resume_collection.delete(ids=existing["ids"])
    except Exception:
        pass

    chunks = chunk_resume_text(resume_text)
    if not chunks:
        print(f"[embeddings] No chunks generated for candidate {candidate_id}")
        return

    embeddings = embed_texts(chunks)
    if not embeddings:
        return

    ids = [f"{candidate_id}_chunk_{i}" for i in range(len(chunks))]
    metadatas = []
    for i, chunk in enumerate(chunks):
        m = dict(metadata or {})
        m["candidate_id"] = str(candidate_id)
        m["chunk_index"] = i
        m["section"] = _detect_section(chunk)
        metadatas.append(m)

    resume_collection.upsert(
        ids=ids,
        embeddings=embeddings,
        documents=chunks,
        metadatas=metadatas,
    )


def get_resume_chunk_embeddings(candidate_id: str):
    """
    Fetch all stored chunk embeddings for a candidate.

    Returns:
        List of dicts: [{"document": str, "embedding": list[float], "metadata": dict}, ...]
        Empty list if none found.
    """
    result = resume_collection.get(
        where={"candidate_id": str(candidate_id)},
        include=["embeddings", "documents", "metadatas"],
    )

    if not result["ids"]:
        return []

    return [
        {"document": doc, "embedding": emb, "metadata": meta}
        for doc, emb, meta in zip(result["documents"], result["embeddings"], result["metadatas"])
    ]


def upsert_job_embedding(job_id: str, jd_text: str, metadata: dict | None = None):
    """Store/update a job description's embedding in ChromaDB, keyed by job_id."""
    if not jd_text or not jd_text.strip():
        print(f"[embeddings] Skipping empty JD text for job {job_id}")
        return

    embedding = embed_text(jd_text)

    job_collection.upsert(
        ids=[str(job_id)],
        embeddings=[embedding],
        documents=[jd_text],
        metadatas=[metadata or {}],
    )


def get_job_embedding(job_id: str):
    """Fetch a stored job embedding by job_id."""
    result = job_collection.get(ids=[str(job_id)], include=["embeddings", "documents", "metadatas"])
    if not result["ids"]:
        return None
    return {
        "id": result["ids"][0],
        "embedding": result["embeddings"][0],
        "document": result["documents"][0],
        "metadata": result["metadatas"][0],
    }


def cosine_similarity(vec_a: list[float], vec_b: list[float]) -> float:
    """Compute cosine similarity between two vectors."""
    import numpy as np
    a = np.array(vec_a)
    b = np.array(vec_b)
    if not a.any() or not b.any():
        return 0.0
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


def max_similarity_to_chunks(jd_embedding: list[float], chunk_records: list[dict]) -> tuple[float, str, str]:
    """
    Compute the max WEIGHTED cosine similarity between the JD embedding
    and any resume chunk embedding. Each chunk's raw similarity is
    multiplied by its section weight (SECTION_WEIGHTS) before comparison.

    Returns:
        (best_weighted_score, best_chunk_text, best_chunk_section)
    """
    if not chunk_records:
        return 0.0, "", ""

    best_score = -1.0
    best_chunk = ""
    best_section = "unknown"

    for record in chunk_records:
        raw_score = cosine_similarity(jd_embedding, record["embedding"])
        section = record.get("metadata", {}).get("section", "unknown")
        weight = SECTION_WEIGHTS.get(section, DEFAULT_SECTION_WEIGHT)
        weighted_score = raw_score * weight

        if weighted_score > best_score:
            best_score = weighted_score
            best_chunk = record["document"]
            best_section = section

    return max(best_score, 0.0), best_chunk, best_section


# ─── Quick test when run directly ───
if __name__ == "__main__":
    sample_jd = "Looking for a Python developer with experience in FastAPI and PostgreSQL.\n\nKey skills required: react, node.js, sql"
    sample_resume = """EDUCATION
Bachelor of Technology - Information Technology, GPA 7.27

TECHNICAL SKILLS
Languages: Java, Python, C/C++, SQL (Postgres), JavaScript, HTML/CSS, R
Frameworks: React, Node.js, Flask, JUnit, WordPress, Material-UI, FastAPI"""

    jd_emb = embed_text(sample_jd)

    chunks = chunk_resume_text(sample_resume)
    print(f"Generated {len(chunks)} chunks:")
    for i, c in enumerate(chunks):
        section = _detect_section(c)
        print(f"--- Chunk {i} (section: {section}) ---\n{c}\n")

    chunk_embeddings = embed_texts(chunks)
    chunk_records = [
        {"document": c, "embedding": e, "metadata": {"section": _detect_section(c)}}
        for c, e in zip(chunks, chunk_embeddings)
    ]

    best_score, best_chunk, best_section = max_similarity_to_chunks(jd_emb, chunk_records)
    print(f"Best weighted score: {best_score:.4f} (section: {best_section})")
    print(f"Best matching chunk:\n{best_chunk}")