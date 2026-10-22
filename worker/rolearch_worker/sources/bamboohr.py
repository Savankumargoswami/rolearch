"""BambooHR career pages: {company}.bamboohr.com/careers/list (public JSON the careers page itself uses).

Descriptions come from /careers/{id}/detail, at most DETAILS_PER_RUN per company per run.
"""

from __future__ import annotations

import asyncio
import os

from ..geo import country_code
from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

DETAILS_PER_RUN = int(os.environ.get("BAMBOOHR_DETAILS_PER_RUN", "300"))


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    base = f"https://{company.token}.bamboohr.com/careers"
    data = await http.json(f"{base}/list")
    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(j: dict) -> RawJob:
        nonlocal budget
        ats, loc = j.get("atsLocation") or {}, j.get("location") or {}
        city = ats.get("city") or loc.get("city")
        region = ats.get("state") or ats.get("province") or loc.get("state")
        country = ats.get("country")
        url = f"{base}/{j['id']}"
        raw = RawJob(
            external_id=str(j["id"]),
            title=(j.get("jobOpeningName") or "").strip(),
            job_url=url,
            apply_url=url,
            location_text=", ".join(x for x in (city, region, country) if x),
            country_hint=country_code(country or ""),
            city_hint=city,
            # locationType's codes aren't documented, so only the explicit remote flag is trusted.
            workplace_hint="remote" if j.get("isRemote") else None,
            department=j.get("departmentLabel") or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            async with sem:
                try:
                    d = ((await http.json(f"{url}/detail")).get("result") or {}).get("jobOpening") or {}
                except Exception:
                    return raw
            raw.description = html_to_text(d.get("description"))[:20000]
            raw.posted_at = parse_time(d.get("datePosted"))
        return raw

    return list(await asyncio.gather(*(one(j) for j in data.get("result") or [] if j.get("id"))))
