"""SmartRecruiters Posting API: api.smartrecruiters.com/v1/companies/{id}/postings (public).

The list has no description, so each run fetches at most DETAILS_PER_RUN descriptions per company
(jobs we already have a description for are only marked as still open); later runs fill in the rest.
"""

from __future__ import annotations

import asyncio
import os

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

API = "https://api.smartrecruiters.com/v1/companies/{c}/postings"
MAX_POSTINGS = 2000
DETAILS_PER_RUN = int(os.environ.get("SMARTRECRUITERS_DETAILS_PER_RUN", "300"))


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    postings, offset = [], 0
    while offset < MAX_POSTINGS:
        page = await http.json(API.format(c=company.token), params={"limit": 100, "offset": offset})
        content = page.get("content") or []
        postings.extend(content)
        offset += len(content)
        if not content or offset >= (page.get("totalFound") or 0):
            break

    async def detail(pid: str) -> str:
        try:
            d = await http.json(f"{API.format(c=company.token)}/{pid}")
        except Exception:
            return ""
        sections = ((d.get("jobAd") or {}).get("sections")) or {}
        return "\n\n".join(html_to_text((s or {}).get("text")) for s in sections.values())

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)

    async def one(p: dict) -> RawJob:
        nonlocal budget
        loc = p.get("location") or {}
        url = f"https://jobs.smartrecruiters.com/{company.token}/{p['id']}"
        workplace = "remote" if loc.get("remote") else "hybrid" if loc.get("hybrid") else None
        raw = RawJob(
            external_id=str(p["id"]),
            title=(p.get("name") or "").strip(),
            job_url=url,
            apply_url=url,
            location_text=loc.get("fullLocation") or ", ".join(x for x in (loc.get("city"), loc.get("country")) if x),
            country_hint=(loc.get("country") or "").upper() or None,
            city_hint=loc.get("city"),
            workplace_hint=workplace,
            posted_at=parse_time(p.get("releasedDate")),
            department=((p.get("department") or {}).get("label")) or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            async with sem:
                raw.description = (await detail(p["id"]))[:20000]
        return raw

    return list(await asyncio.gather(*(one(p) for p in postings if p.get("id"))))
