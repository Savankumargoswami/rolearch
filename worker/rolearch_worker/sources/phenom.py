"""Phenom career sites (jobs.cvshealth.com, talent.lowes.com, www.jobs-ups.com, ...).

Token format: "host|refNum|locale", e.g. "jobs.cvshealth.com|CVSCHLUS|en_us". The site's own search
widget (POST /widgets, ddoKey=refineSearch) returns jobs with a teaser and extracted skills; the full
description comes from each job's page (phApp data), read for up to DETAILS_PER_RUN new jobs a run.
Job and apply links go to the job's page on the company's career site.
"""

from __future__ import annotations

import asyncio
import json
import os
import re

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

PAGE = 100
MAX_JOBS = int(os.environ.get("PHENOM_MAX_JOBS", "10000"))
DETAILS_PER_RUN = int(os.environ.get("PHENOM_DETAILS_PER_RUN", "300"))
_PHENOM = asyncio.Semaphore(int(os.environ.get("PHENOM_CONCURRENCY", "4")))
_DESC = re.compile(r'"jobDetail"\s*:\s*\{.*?"description"\s*:\s*("(?:[^"\\]|\\.)*")', re.S)


def _slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:80] or "job"


def _body(ref: str, locale: str, start: int) -> dict:
    return {
        "lang": locale, "deviceType": "desktop", "country": locale.split("_")[-1], "pageName": "search-results",
        "ddoKey": "refineSearch", "sortBy": "Most recent", "subsearch": "", "from": start, "jobs": True, "counts": False,
        "all_fields": [], "size": PAGE, "clearAll": False, "jdsource": "facets", "isSliderEnable": False, "pageId": "page20",
        "siteType": "external", "keywords": "", "global": True, "selected_fields": {}, "refNum": ref,
    }


async def _search(http: Fetcher, host: str, ref: str, locale: str, start: int) -> dict:
    async with _PHENOM:
        return (await http.post_json(f"https://{host}/widgets", _body(ref, locale, start))).get("refineSearch") or {}


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host, ref, locale = company.token.split("|")
    lang, country = locale.split("_")[0], locale.split("_")[-1]
    prefix = f"{country}/{lang}"

    first = await _search(http, host, ref, locale, 0)
    total = min(int(first.get("totalHits") or 0), MAX_JOBS)
    jobs = list((first.get("data") or {}).get("jobs") or [])
    step = len(jobs) or PAGE
    rest = await asyncio.gather(*(_search(http, host, ref, locale, s) for s in range(step, total, step)), return_exceptions=True)
    for r in rest:
        if isinstance(r, dict):
            jobs.extend((r.get("data") or {}).get("jobs") or [])

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    seen: set[str] = set()

    async def one(j: dict) -> RawJob | None:
        nonlocal budget
        jid = str(j.get("jobId") or j.get("reqId") or "")
        title = (j.get("title") or "").strip()
        if not jid or not title or jid in seen:
            return None
        seen.add(jid)
        url = f"https://{host}/{prefix}/job/{jid}/{_slug(title)}"
        remote = bool(j.get("remote") or j.get("isRemote")) or "remote" in str(j.get("location", "")).lower()
        skills = ", ".join(j.get("ml_skills") or [])
        raw = RawJob(
            external_id=jid,
            title=title,
            job_url=url,
            apply_url=url,
            location_text=j.get("cityStateCountry") or j.get("location") or "",
            city_hint=j.get("city") or None,
            workplace_hint="remote" if remote else None,
            posted_at=parse_time(j.get("postedDate") or j.get("dateCreated")),
            description="\n\n".join(x for x in (j.get("descriptionTeaser") or "", f"Skills: {skills}" if skills else "") if x),
            department=j.get("department") or j.get("category") or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget <= 0:
            return raw
        budget -= 1
        try:
            async with _PHENOM:
                page = (await http.get(url)).text
            m = _DESC.search(page)
            if m:
                full = html_to_text(json.loads(m.group(1)))
                if len(full) > len(raw.description):
                    raw.description = full[:20000]
        except Exception:
            pass
        return raw

    return [r for r in await asyncio.gather(*(one(j) for j in jobs)) if r]
