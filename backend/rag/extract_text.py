import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import hashlib
from pypdf import PdfReader
from config import get_resume_full_path, CACHE_DIR

os.makedirs(CACHE_DIR, exist_ok=True)


def _cache_path(resume_path: str) -> str:
    """Generate a cache file path based on a hash of the resume path."""
    h = hashlib.md5(resume_path.encode("utf-8")).hexdigest()
    return os.path.join(CACHE_DIR, f"{h}.txt")


def extract_text_from_pdf(resume_path: str, use_cache: bool = True) -> str:
    """
    Extract text from a resume PDF.

    Args:
        resume_path: DB-style path, e.g. /uploads/resumes/123_johndoe.pdf
        use_cache: if True, read/write from resumes_cache to avoid re-parsing

    Returns:
        Extracted text as a string. Empty string if extraction fails.
    """
    cache_file = _cache_path(resume_path)

    if use_cache and os.path.exists(cache_file):
        with open(cache_file, "r", encoding="utf-8") as f:
            return f.read()

    full_path = get_resume_full_path(resume_path)

    if not os.path.exists(full_path):
        print(f"[extract_text] File not found: {full_path}")
        return ""

    text_parts = []
    try:
        reader = PdfReader(full_path)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    except Exception as e:
        print(f"[extract_text] Failed to read {full_path}: {e}")
        return ""

    full_text = "\n".join(text_parts).strip()

    # Basic cleanup: collapse excessive whitespace
    full_text = "\n".join(line.strip() for line in full_text.splitlines() if line.strip())

    if use_cache and full_text:
        with open(cache_file, "w", encoding="utf-8") as f:
            f.write(full_text)

    return full_text


# ─── Quick test when run directly ───
if __name__ == "__main__":
    test_response = None
    try:
        from backend.config import supabase
        test_response = (
            supabase.table("candidates")
            .select("id, resume_path")
            .limit(1)
            .execute()
        )
    except Exception as e:
        print("Could not fetch candidate from Supabase:", e)

    if test_response and test_response.data:
        candidate = test_response.data[0]
        path = candidate.get("resume_path")
        print(f"Testing extraction for: {path}")
        text = extract_text_from_pdf(path)
        print(f"Extracted {len(text)} characters")
        print(text[:500])
    else:
        print("No candidate found to test with.")