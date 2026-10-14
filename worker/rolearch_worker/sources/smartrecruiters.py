"""SmartRecruiters Posting API: api.smartrecruiters.com/v1/companies/{id}/postings (public).

The list has no description, so details are fetched only for launch-field titles
to keep request volume low on large employers (some list thousands of postings).
"""

from __future__ import annotations

import asyncio

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text, in_launch_field
from ._util import parse_time

API = "https://api.smartrecruiters.com/v1/companies/{c}/postings"
MAX_POSTINGS = 2000


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

    wanted = [p for p in postings if in_launch_field(p.get("name", ""))]
    descriptions = dict(zip((p["id"] for p in wanted), await asyncio.gather(*(detail(p["id"]) for p in wanted))))

    jobs = []
    for p in postings:
        loc = p.get("location") or {}
        url = f"https://jobs.smartrecruiters.com/{company.token}/{p['id']}"
        workplace = "remote" if loc.get("remote") else "hybrid" if loc.get("hybrid") else None
        jobs.append(
            RawJob(
                external_id=str(p["id"]),
                title=(p.get("name") or "").strip(),
                job_url=url,
                apply_url=url,
                location_text=loc.get("fullLocation") or ", ".join(x for x in (loc.get("city"), loc.get("country")) if x),
                country_hint=(loc.get("country") or "").upper() or None,
                city_hint=loc.get("city"),
                workplace_hint=workplace,
                posted_at=parse_time(p.get("releasedDate")),
                description=descriptions.get(p["id"], ""),
                department=((p.get("department") or {}).get("label")) or "",
            )
        )
    return jobs
