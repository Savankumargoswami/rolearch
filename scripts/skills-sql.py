"""Prints the database side of the skill dictionary from worker/rolearch_worker/data/skills.json (the single source):
the boilerplate filter (private.strip_boilerplate) and the skill_patterns seed.
After editing skills.json:  python scripts/skills-sql.py > db/seed.sql  and run it in Supabase.
db/044_skill_dictionary_v2.sql is the first run of this, plus re-tagging every open job."""
import json
import pathlib

src = pathlib.Path(__file__).resolve().parents[1] / "worker" / "rolearch_worker" / "data" / "skills.json"
doc = json.loads(src.read_text(encoding="utf-8"))
skills = doc["skills"]
BS = chr(92)  # backslash: Python's \b (word boundary) is \y in PostgreSQL regexes


def pg(p):
    if not p:
        return "null"
    return "'" + p.replace(BS + "b", BS + "y").replace("'", "''") + "'"


print("-- Boilerplate (legal notices, pay and benefits): sentences matching this are skipped before counting skills.")
print("-- Same rule as strip_boilerplate() in worker/rolearch_worker/text.py.")
print("create or replace function private.strip_boilerplate(p_text text)")
print("returns text")
print("language sql")
print("immutable")
print("set search_path = ''")
print("as $fn$")
print("  select coalesce(string_agg(piece, chr(10)), '')")
print(f"  from regexp_split_to_table(coalesce(p_text, ''), {pg(BS + 'n|[.!?;•]' + BS + 's+')}) as piece")
print(f"  where btrim(piece) <> '' and piece !~* {pg(doc['boilerplate'])}")
print("$fn$;")
print()
rows = []
for name, spec in skills.items():
    cs, ci = (None, spec) if isinstance(spec, str) else (spec.get("cs"), spec.get("ci"))
    rows.append(f"  ('{name}', {pg(cs)}, {pg(ci)})")
print("truncate private.skill_patterns;")
print("insert into private.skill_patterns (name, cs, ci) values")
print(",\n".join(rows) + ";")
