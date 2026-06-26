import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
import json
from config import groq_client

GROQ_MODEL = "llama-3.3-70b-versatile"

SIMILARITY_THRESHOLD = 0.35

VERDICT_PROMPT = """You are a recruitment assistant. Compare the candidate's resume against the job description and decide whether they should be shortlisted.

Job Description (including required keywords/skills):
{jd_text}

Candidate Resume:
{resume_text}

Similarity Score (0-1): {similarity_score}
Similarity Threshold: {threshold} (scores below this indicate weak alignment with the role)

Instructions:
- If similarity_score is within 0.05 of the threshold AND the resume explicitly mentions at least 2 of the required keywords, shortlist. Otherwise, if below threshold, reject.
- Treat the similarity score as a strong signal. If the score is below the threshold, you should generally lean toward "rejected" unless the resume contains very strong, explicit evidence of the exact skills/keywords required (e.g. direct mentions of React, Node.js, SQL, or equivalent).
- If the score is at or above the threshold, lean toward "shortlisted" unless the resume clearly lacks the required skills.
- Do not ignore the similarity score in favor of general resume quality alone.

Respond ONLY with a JSON object in this exact format, no markdown, no extra text:
{{
  "shortlist": true or false,
  "status": "shortlisted" or "rejected",
  "reasoning": "2-3 sentence explanation of the decision, referencing the similarity score and specific skills found or missing"
}}
"""


def get_llm_verdict(jd_text: str, resume_text: str, similarity_score: float, threshold: float = SIMILARITY_THRESHOLD) -> dict:
    """
    Ask Groq LLM for a shortlist verdict based on JD, resume, and similarity score.

    Returns:
        dict with keys: shortlist (bool), status (str), reasoning (str)
    """
    prompt = VERDICT_PROMPT.format(
        jd_text=jd_text[:4000],
        resume_text=resume_text[:4000],
        similarity_score=round(similarity_score, 4),
        threshold=threshold,
    )

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You are a precise JSON-only response generator."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
            max_tokens=400,
        )

        content = response.choices[0].message.content.strip()

        # Strip markdown fences if present
        if content.startswith("```"):
            content = content.strip("`")
            if content.startswith("json"):
                content = content[4:].strip()

        verdict = json.loads(content)

        # Validate expected keys
        if not all(k in verdict for k in ("shortlist", "status", "reasoning")):
            raise ValueError("Missing expected keys in LLM response")

        return verdict

    except Exception as e:
        print(f"[shortlist] LLM verdict failed: {e}")
        return {
            "shortlist": False,
            "status": "error",
            "reasoning": f"LLM verdict could not be generated: {e}",
        }


# ─── Quick test when run directly ───
if __name__ == "__main__":
    jd = "Design, build, and optimize scalable software systems, collaborate with cross-functional teams, ensure code quality, and deliver innovative solutions aligned with business goals.\n\nKey skills: react, node.js, sql"
    resume = "Experienced backend developer skilled in Python, FastAPI, React, Node.js, and SQL databases."

    verdict = get_llm_verdict(jd, resume, similarity_score=0.45)
    print(json.dumps(verdict, indent=2))