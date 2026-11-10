"""Prints the database side of the skill dictionary from worker/rolearch_worker/data/skills.json (the single source):
the text filter (private.strip_boilerplate), the hint-aware matcher (private.extract_skills) and the skill_patterns
seed with hint words (scripts/skill_hints.py).
After editing skills.json:  python -X utf8 scripts/skills-sql.py > db/seed.sql  and run it in Supabase.
db/046_skill_dictionary_v3.sql is a run of this, plus re-tagging every open job."""
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from skill_hints import hints_for  # noqa: E402

src = pathlib.Path(__file__).resolve().parents[1] / "worker" / "rolearch_worker" / "data" / "skills.json"
doc = json.loads(src.read_text(encoding="utf-8"))
skills = doc["skills"]
BS = chr(92)  # backslash: Python's \b (word boundary) is \y in PostgreSQL regexes


def pg(p):
    if not p:
        return "null"
    return "'" + p.replace(BS + "b", BS + "y").replace("'", "''") + "'"


def arr(xs):
    if not xs:
        return "null"
    return "array[" + ", ".join("'" + x.replace("'", "''") + "'" for x in xs) + "]::text[]"


print("alter table private.skill_patterns add column if not exists cs_hints text[];")
print("alter table private.skill_patterns add column if not exists ci_hints text[];")
print()
print("-- Text the skills are counted on: legal notices, pay and benefits sentences dropped; department names after")
print("-- \"partner with / collaborate with / teams including\" blanked. Same rule as strip_boilerplate() in worker/rolearch_worker/text.py.")
print("create or replace function private.strip_boilerplate(p_text text)")
print("returns text")
print("language sql")
print("immutable")
print("set search_path = ''")
print("as $fn$")
print("  select regexp_replace(coalesce(string_agg(piece, chr(10)), ''),")
print(f"         {pg(doc['department_mentions'])},")
print("         ' ', 'gi')")
print(f"  from regexp_split_to_table(coalesce(p_text, ''), {pg(BS + 'n|[.!?;•]' + BS + 's+')}) as piece")
print(f"  where btrim(piece) <> '' and piece !~* {pg(doc['boilerplate'])}")
print("$fn$;")
print()
print("-- The skills a text mentions, most-mentioned first. A pattern's regex runs only when one of its hint words is in the")
print("-- text (a cheap substring check): about 3x faster than running all ~500 regexes on every job, same result.")
print("create or replace function private.extract_skills(p_text text)")
print("returns text[]")
print("language sql")
print("stable")
print("set search_path = ''")
print("as $fn$")
print("  with t as (select coalesce(p_text, '') as t, lower(coalesce(p_text, '')) as lt)")
print("  select coalesce(array_agg(name order by n desc, name), '{}')")
print("  from (")
print("    select p.name,")
print("           (case when p.cs is not null and (p.cs_hints is null or exists (select 1 from unnest(p.cs_hints) h where strpos(t.t, h) > 0))")
print("                 then regexp_count(t.t, p.cs) else 0 end)")
print("         + (case when p.ci is not null and (p.ci_hints is null or exists (select 1 from unnest(p.ci_hints) h where strpos(t.lt, h) > 0))")
print("                 then regexp_count(t.t, p.ci, 1, 'i') else 0 end) as n")
print("    from private.skill_patterns as p cross join t")
print("  ) as m")
print("  where n > 0")
print("$fn$;")
print()
rows = []
for name, spec in skills.items():
    cs, ci = (None, spec) if isinstance(spec, str) else (spec.get("cs"), spec.get("ci"))
    rows.append(f"  ('{name}', {pg(cs)}, {pg(ci)}, {arr(hints_for(cs, False))}, {arr(hints_for(ci, True))})")
print("truncate private.skill_patterns;")
print("insert into private.skill_patterns (name, cs, ci, cs_hints, ci_hints) values")
print(",\n".join(rows) + ";")
