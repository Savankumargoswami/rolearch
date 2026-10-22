"""Rippling ATS job boards: ats.rippling.com/api/v2/board/{slug}/jobs (public, no key).

The list has title, department and locations; the description comes from each job's detail call, at most
DETAILS_PER_RUN per company per run (jobs we already have a description for are only marked as still open).
"""

from __future__ import annotations

import asyncio
import os

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time, workplace_of

API = "https://ats.rippling.com/api/v2/board/{slug}/jobs"
DETAILS_PER_RUN = int(os.environ.get("RIPPLING_DETAILS_PER_RUN", "300"))
MAX_PAGES = 50


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    items, page = [], 0
    while page < MAX_PAGES:
        data = await http.json(API.format(slug=company.token), params={"page": page, "pageSize": 50})
        items.extend(data.get("items") or [])
        page += 1
        if page >= (data.get("totalPages") or 0):
            break

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)

    async def one(j: dict) -> RawJob:
        nonlocal budget
        locs = j.get("locations") or []
        first = locs[0] if locs else {}
        url = j.get("url") or f"https://ats.rippling.com/{company.token}/jobs/{j['id']}"
        raw = RawJob(
            external_id=str(j["id"]),
            title=(j.get("name") or "").strip(),
            job_url=url,
            apply_url=url,
            location_text=first.get("name") or "",
            country_hint=first.get("countryCode"),
            city_hint=first.get("city"),
            workplace_hint=workplace_of(first.get("workplaceType")),
            department=(j.get("department") or {}).get("name") or "",
            extra_locations=[x["name"] for x in locs[1:] if x.get("name")],
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            async with sem:
                try:
                    d = await http.json(f"{API.format(slug=company.token)}/{j['id']}")
                except Exception:
                    return raw
            desc = d.get("description")
            parts = desc.values() if isinstance(desc, dict) else [desc]
            raw.description = "\n\n".join(html_to_text(p) for p in parts if isinstance(p, str))[:20000]
            raw.posted_at = parse_time(d.get("createdOn"))
            for pay in d.get("payRangeDetails") or []:
                if pay.get("rangeStart") and pay.get("rangeEnd") and pay.get("currency"):
                    period = "hour" if pay.get("frequency") == "HOUR" else "year"
                    raw.salary = Salary(float(pay["rangeStart"]), float(pay["rangeEnd"]), pay["currency"], period)
                    break
        return raw

    return list(await asyncio.gather(*(one(j) for j in items if j.get("id"))))
