import os
from backend.config import supabase, get_resume_full_path

rows = supabase.table("candidates").select("id, name, resume_path").execute().data

if not rows:
    print("No candidates found in Supabase at all.")
else:
    print(f"Found {len(rows)} candidate(s):\n")
    for r in rows:
        name = r.get("name", "Unknown")
        path = r.get("resume_path")
        if not path:
            print(f"{name} | resume_path: NONE IN DB | file exists: N/A")
            continue
        full = get_resume_full_path(path)
        exists = os.path.exists(full)
        print(f"{name} | resume_path: {path} | file exists: {exists} | full_path: {full}")