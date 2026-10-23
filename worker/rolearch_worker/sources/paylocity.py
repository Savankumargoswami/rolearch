"""Paylocity, common among mid-size US employers: recruiting.paylocity.com/recruiting/jobs/All/{company-guid}.

Token: the company's guid. The board page carries every open job as data (window.pageData: title, address,
publish date, department, remote flag, a short excerpt); the host has no robots.txt. Full descriptions come from
each job's page (its JobPosting data), at most DETAILS_PER_RUN new ones per company per run.
"""

from __future__ import annotations

import asyncio
import json
import os
import re

from ..http import Fetcher
from ..models import Company, RawJob
from ._util import parse_time
from .jsonld import _postings, _to_raw

BASE = "https://recruiting.paylocity.com"
DETAILS_PER_RUN = int(os.environ.get("PAYLOCITY_DETAILS_PER_RUN", "200"))
_DATA = re.compile(r"window\.pageData\s*=\s*(\{.*?\});\s*</script>", re.S)
_COUNTRY = {"USA": "US", "US": "US", "CAN": "CA", "Canada": "CA"}


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    page = await http.get(f"{BASE}/recruiting/jobs/All/{company.token.strip()}/jobs")
    m = _DATA.search(page.text) if page.status_code == 200 else None
    if not m:
        return []
    data = json.loads(m.group(1))
    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(j: dict) -> RawJob:
        nonlocal budget
        loc = j.get("JobLocation") or {}
        city, state, country = loc.get("City") or "", loc.get("State") or "", loc.get("Country") or ""
        url = f"{BASE}/Recruiting/Jobs/Details/{j['JobId']}"
        raw = RawJob(
            external_id=str(j["JobId"]),
            title=(j.get("JobTitle") or "").strip(),
            job_url=url,
            apply_url=url,
            location_text=", ".join(x for x in (city, state) if x) or (j.get("LocationName") or ""),
            country_hint=_COUNTRY.get(country, country[:2].upper() if len(country) == 2 else None),
            city_hint=city or None,
            workplace_hint="remote" if j.get("IsRemote") else None,
            posted_at=parse_time(j.get("PublishedDate")),
            description=(j.get("Description") or "").strip(),
            department=j.get("HiringDepartment") or "",
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
                raw.description = full.description[:20000] or raw.description
                raw.salary = full.salary
        return raw

    jobs = [j for j in data.get("Jobs") or [] if j.get("JobId") and not j.get("IsInternal")]
    return list(await asyncio.gather(*(one(j) for j in jobs)))
