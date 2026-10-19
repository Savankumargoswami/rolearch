"""Find companies that are hiring, using Adzuna's API only as a list of employer names.

Adzuna's own listings aren't shown on Rolearch: their links go through Adzuna (often on to other job
boards), and following them automatically would register fake clicks. Instead we take the names of
the employers posting the most jobs, add them to candidates.csv, and `discover` then looks for each
one's public careers board (Greenhouse, Lever, Ashby, ...), so their jobs come straight from the company.
"""

from __future__ import annotations

import csv
import os
import re
from collections import Counter
from pathlib import Path

from .http import Fetcher
from .sources.adzuna import API, PREFERRED

# Staffing agencies and marketplaces aren't employers with their own boards.
_SKIP = re.compile(r"\b(staffing|recruit(ment|ing|ers)?|talent|agency|personnel|jobs?|careers|hiring|shoppers|employment|workforce|search|consult(ing|ants)|solutions group|resourcing|unknown|confidential)\b", re.I)


async def adzuna_employers(countries: list[str], calls_per_country: int) -> Counter[tuple[str, str]]:
    auth = {"app_id": os.environ["ADZUNA_APP_ID"], "app_key": os.environ["ADZUNA_APP_KEY"]}
    counts: Counter[tuple[str, str]] = Counter()
    async with Fetcher() as http:
        for country in countries:
            for tag in PREFERRED[:calls_per_country]:
                try:
                    data = await http.json(
                        API.format(country=country, what="search/1"),
                        params={**auth, "category": tag, "results_per_page": 50, "sort_by": "date", "content-type": "application/json"},
                    )
                except Exception:
                    continue
                for j in data.get("results", []):
                    name = ((j.get("company") or {}).get("display_name") or "").strip()
                    if name and len(name) <= 60 and not _SKIP.search(name):
                        counts[(name, country.upper())] += 1
    return counts


def slugs_for(name: str) -> list[str]:
    base = re.sub(r"\b(inc|llc|ltd|limited|plc|corp(oration)?|co|company|group|holdings|gmbh|pvt|private)\b\.?", "", name, flags=re.I)
    words = [w for w in re.split(r"[^a-z0-9]+", base.lower()) if w]
    if not words:
        return []
    # Full name only: a first-word guess ("David", "Amazon") matches unrelated small boards.
    out = ["".join(words), "-".join(words)]
    return list(dict.fromkeys(s for s in out if len(s) >= 3))


def add_candidates(path: Path, found: Counter[tuple[str, str]], existing_names: set[str], limit: int) -> int:
    known = set(existing_names)
    with path.open(encoding="utf-8", newline="") as f:
        known |= {r["name"].strip().lower() for r in csv.DictReader(f) if r.get("name")}
    rows = []
    for (name, country), _ in found.most_common():
        if name.lower() in known:
            continue
        known.add(name.lower())
        rows.append([name, "GB" if country == "GB" else country, "|".join(slugs_for(name)), ""])
        if len(rows) >= limit:
            break
    with path.open("a", encoding="utf-8", newline="") as f:
        csv.writer(f).writerows(rows)
    return len(rows)
