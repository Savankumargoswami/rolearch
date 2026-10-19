"""Amazon jobs (www.amazon.jobs): the site's own search JSON, which robots.txt allows.

Token: unused ("all"). One search returns at most 10,000 jobs, so we take the newest 10,000 overall and
then the newest from each of Amazon's largest hiring countries, deduped. Descriptions and qualifications
come in the same response. Links go to the job's page on amazon.jobs.
"""

from __future__ import annotations

import asyncio
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

API = "https://www.amazon.jobs/en/search.json"
PAGE = 100
CAP = 10_000
COUNTRIES = ["USA", "IND", "GBR", "DEU", "CAN", "JPN", "IRL", "ESP", "FRA", "POL", "ITA", "AUS", "SGP", "MEX", "BRA"]


def _date(s: str | None) -> datetime | None:
    try:
        return datetime.strptime((s or "").strip(), "%B %d, %Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _raw(j: dict) -> RawJob | None:
    if not j.get("id") or not j.get("title") or not j.get("job_path"):
        return None
    url = f"https://www.amazon.jobs{j['job_path']}"
    text = "\n\n".join(x for x in (j.get("description"), j.get("basic_qualifications"), j.get("preferred_qualifications")) if x)
    return RawJob(
        external_id=str(j["id"]),
        title=j["title"].strip(),
        job_url=url,
        apply_url=url,
        location_text=j.get("normalized_location") or j.get("location") or "",
        city_hint=j.get("city") or None,
        posted_at=_date(j.get("posted_date")),
        description=html_to_text(text)[:20000],
        department=j.get("job_category") or "",  # company stays "Amazon", not the hiring legal entity
    )


async def _pages(http: Fetcher, extra: dict) -> list[dict]:
    first = await http.json(API, params={"offset": 0, "result_limit": PAGE, "sort": "recent", **extra})
    total = min(int(first.get("hits") or 0), CAP)
    jobs = list(first.get("jobs") or [])
    sem = asyncio.Semaphore(4)

    async def page(offset: int):
        async with sem:
            return await http.json(API, params={"offset": offset, "result_limit": PAGE, "sort": "recent", **extra})

    for r in await asyncio.gather(*(page(o) for o in range(PAGE, total, PAGE)), return_exceptions=True):
        if isinstance(r, dict):
            jobs.extend(r.get("jobs") or [])
    return jobs


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    found: dict[str, RawJob] = {}
    for extra in [{}, *({"normalized_country_code[]": c} for c in COUNTRIES)]:
        try:
            batch = await _pages(http, extra)
        except Exception:
            continue
        for j in batch:
            raw = _raw(j)
            if raw:
                found.setdefault(raw.external_id, raw)
    return list(found.values())
