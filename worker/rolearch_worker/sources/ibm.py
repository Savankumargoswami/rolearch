"""IBM careers: the search API behind ibm.com/careers/search (www-api.ibm.com/search/api/v2).

Token: unused ("all"). Returns every job with title, location ("Bangalore, IN"), work arrangement and a
description excerpt, 100 at a time. IBM's job pages don't serve automated readers, so the excerpt is
the description we keep. Links go to the job on careers.ibm.com.
"""

from __future__ import annotations

import asyncio
import re

from ..http import Fetcher
from ..models import Company, RawJob

API = "https://www-api.ibm.com/search/api/v2"
PAGE = 100
MAX_JOBS = 10_000
FIELDS = ["_id", "title", "url", "description", "language", "field_keyword_17", "field_keyword_08", "field_keyword_18", "field_keyword_19"]


def _body(start: int) -> dict:
    return {
        "appId": "careers", "scopes": ["careers2"], "query": {"bool": {"must": []}}, "size": PAGE, "from": start,
        "sort": [{"_score": "desc"}, {"pageviews": "desc"}], "lang": "zz", "localeSelector": {}, "sm": {"query": "", "lang": "zz"},
        "_source": FIELDS,
    }


def _raw(hit: dict) -> RawJob | None:
    s = hit.get("_source") or {}
    url = s.get("url") or ""
    jid = re.search(r"jobId=(\d+)", url)
    if not s.get("title") or not jid:
        return None
    loc = s.get("field_keyword_19") or ""
    code = loc.rsplit(",", 1)[-1].strip() if "," in loc else ""
    arrangement = (s.get("field_keyword_17") or "").lower()
    return RawJob(
        external_id=jid.group(1),
        title=s["title"].strip(),
        job_url=url,
        apply_url=url,
        location_text=loc,
        city_hint=loc.split(",")[0].strip() or None,
        country_hint=code if re.fullmatch(r"[A-Z]{2}", code) else None,
        workplace_hint="remote" if "remote" in arrangement else "hybrid" if "hybrid" in arrangement else "onsite" if "on-site" in arrangement or "onsite" in arrangement else None,
        description=(s.get("description") or "").strip(),
        department=s.get("field_keyword_08") or "",
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    sem = asyncio.Semaphore(3)  # the API throttles bursts; a few at a time gets every page

    async def page(start: int) -> dict:
        async with sem:
            return await http.post_json(API, _body(start))

    first = await page(0)
    total = min(int(((first.get("hits") or {}).get("total") or {}).get("value") or 0), MAX_JOBS)
    hits = list((first.get("hits") or {}).get("hits") or [])
    for r in await asyncio.gather(*(page(s) for s in range(PAGE, total, PAGE)), return_exceptions=True):
        if isinstance(r, dict):
            hits.extend((r.get("hits") or {}).get("hits") or [])
    jobs: dict[str, RawJob] = {}
    for h in hits:
        raw = _raw(h)
        if raw:
            jobs.setdefault(raw.external_id, raw)
    return list(jobs.values())
