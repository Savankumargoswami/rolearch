"""Breezy HR career pages: {company}.breezy.hr/json lists every opening (title, location, department, type, date,
and the employer's own name); each job page carries a schema.org JobPosting with the description, fetched at most
DETAILS_PER_RUN per run.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime

from ..http import Fetcher
from ..models import Company, RawJob
from .jsonld import _postings, _to_raw

DETAILS_PER_RUN = int(os.environ.get("BREEZY_DETAILS_PER_RUN", "200"))


def _when(s: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00")) if s else None
    except ValueError:
        return None


async def positions(http: Fetcher, token: str) -> list[dict]:
    data = await http.json(f"https://{token}.breezy.hr/json")
    return data if isinstance(data, list) else []


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(p: dict) -> RawJob:
        nonlocal budget
        loc = p.get("location") or {}
        country = (loc.get("country") or {}).get("id")
        url = p.get("url") or f"https://{company.token}.breezy.hr/p/{p.get('friendly_id', p.get('id'))}"
        name = str(loc.get("name") or "")
        raw = RawJob(
            external_id=str(p.get("id")),
            title=str(p.get("name") or "").strip(),
            job_url=url,
            apply_url=url,
            location_text=name,
            country_hint=country.upper() if isinstance(country, str) and len(country) == 2 else None,
            city_hint=loc.get("city") or None,
            workplace_hint="remote" if loc.get("is_remote") or "remote" in name.lower() else None,
            posted_at=_when(p.get("published_date")),
            department=str(p.get("department") or ""),
            extra_locations=[str(x.get("name")) for x in (p.get("locations") or []) if isinstance(x, dict) and x.get("name")],
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            async with sem:
                try:
                    found = _postings((await http.get(url)).text)
                except Exception:
                    return raw
            if found:
                full = _to_raw(found[0], url)
                raw.description, raw.salary = full.description[:20000], full.salary
                raw.workplace_hint = raw.workplace_hint or full.workplace_hint
        return raw

    return list(await asyncio.gather(*(one(p) for p in await positions(http, company.token))))
