"""Prints the skill_patterns seed for db/040 from worker/rolearch_worker/data/skills.json (the single source).
After editing skills.json:  python scripts/skills-sql.py > db/040_seed.sql  and run it in Supabase."""
import json
import pathlib

src = pathlib.Path(__file__).resolve().parents[1] / "worker" / "rolearch_worker" / "data" / "skills.json"
skills = json.loads(src.read_text(encoding="utf-8"))["skills"]
BS = chr(92)  # backslash: Python's \b (word boundary) is \y in PostgreSQL regexes


def pg(p):
    if not p:
        return "null"
    return "'" + p.replace(BS + "b", BS + "y").replace("'", "''") + "'"


rows = []
for name, spec in skills.items():
    cs, ci = (None, spec) if isinstance(spec, str) else (spec["cs"], spec.get("ci"))
    rows.append(f"  ('{name}', {pg(cs)}, {pg(ci)})")
print("truncate private.skill_patterns;")
print("insert into private.skill_patterns (name, cs, ci) values")
print(",\n".join(rows) + ";")
