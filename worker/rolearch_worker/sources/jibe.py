"""Jibe career sites (iCIMS's career-site product: careers.amd.com, jobs.statefarm.com, careers.ulta.com, ...).

Token: the career site's host. Every Jibe site answers /api/jobs with 100 jobs a page, including the full
description, city and coordinates. The job and apply links go to the job's page on the company's own
career site (which hands off to iCIMS when the person applies).
"""

from __future__ import annotations

import asyncio
from datetime import datetime

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 100
MAX_JOBS = 15000


def _date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.strptime(s, "%Y-%m-%dT%H:%M:%S%z")
    except ValueError:
        return None


def _raw(host: str, d: dict) -> RawJob | None:
    slug = str(d.get("slug") or d.get("req_id") or "")
    title = (d.get("title") or "").strip()
    if not slug or not title:
        return None
    url = f"https://{host}/jobs/{slug}?lang={d.get('language') or 'en-us'}"
    parts = [d.get("description"), d.get("responsibilities"), d.get("qualifications")]
    remote = str(d.get("location_type", "")).upper() == "REMOTE" or "remote" in str(d.get("full_location", "")).lower()
    return RawJob(
        external_id=str(d.get("req_id") or slug),
        title=title,
        job_url=url,
        apply_url=url,
        location_text=d.get("full_location") or ", ".join(x for x in (d.get("city"), d.get("state"), d.get("country")) if x),
        country_hint=(d.get("country_code") or "").upper() or None,
        city_hint=d.get("city") or None,
        workplace_hint="remote" if remote else None,
        posted_at=_date(d.get("posted_date") or d.get("create_date")),
        description=html_to_text("\n".join(p for p in parts if p))[:20000],
        department=d.get("department") or "",
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower()
    api = f"https://{host}/api/jobs"
    first = await http.json(api, params={"page": 1, "limit": PAGE})
    total = min(int(first.get("totalCount") or 0), MAX_JOBS)
    pages = [first]
    rest = await asyncio.gather(
        *(http.json(api, params={"page": n, "limit": PAGE}) for n in range(2, (total + PAGE - 1) // PAGE + 1)),
        return_exceptions=True,
    )
    pages += [p for p in rest if isinstance(p, dict)]
    jobs: dict[str, RawJob] = {}
    for page in pages:
        for item in page.get("jobs") or []:
            raw = _raw(host, item.get("data") or {})
            if raw:
                jobs.setdefault(raw.external_id, raw)
    return list(jobs.values())
