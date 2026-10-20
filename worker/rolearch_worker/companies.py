"""Company lists: candidates (to discover) and the verified companies file the worker runs on."""

from __future__ import annotations

import csv
from pathlib import Path

from .models import Company

FIELDS = ["name", "country", "ats", "token", "careers_url", "domain"]


def load(path: Path) -> list[Company]:
    with path.open(encoding="utf-8", newline="") as f:
        rows = [r for r in csv.DictReader(f) if r.get("name") and not r["name"].startswith("#")]
    return [Company(r["name"].strip(), r["country"].strip().upper(), r["ats"].strip().lower(), r["token"].strip(), (r.get("careers_url") or "").strip(), (r.get("domain") or "").strip().lower()) for r in rows]


def save(path: Path, companies: list[Company]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for c in sorted(companies, key=lambda c: (c.country, c.name.lower())):
            w.writerow({"name": c.name, "country": c.country, "ats": c.ats, "token": c.token, "careers_url": c.careers_url, "domain": c.domain})


def load_candidates(path: Path) -> list[tuple[str, str, list[str], str]]:
    """Rows of: name, country, slugs (pipe-separated guesses), careers_url (optional)."""
    with path.open(encoding="utf-8", newline="") as f:
        out = []
        for r in csv.DictReader(f):
            if not r.get("name") or r["name"].startswith("#"):
                continue
            slugs = [s.strip() for s in (r.get("slugs") or "").split("|") if s.strip()]
            out.append((r["name"].strip(), r["country"].strip().upper(), slugs, (r.get("careers_url") or "").strip()))
        return out
