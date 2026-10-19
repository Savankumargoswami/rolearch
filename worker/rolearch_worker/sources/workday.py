"""Workday career sites ({tenant}.{wdN}.myworkdayjobs.com/{site}): the public JSON the sites themselves use.

Token format: "tenant|wdN|site", e.g. "target|wd5|targetcareers". The list endpoint gives title,
location and posting age 20 at a time; the full description needs one request per job. To keep runs
short, a run fetches at most DETAILS_PER_RUN descriptions per company: jobs we already have a
description for are only marked as still open, new jobs beyond the budget are added without a
description, and later runs fill those in. Apply goes to the job's page on the company's own site.
"""

from __future__ import annotations

import asyncio
import os
import re
from datetime import datetime, timedelta, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 20
MAX_JOBS = 5000  # Workday stops paging around here on most tenants
DETAILS_PER_RUN = int(os.environ.get("WORKDAY_DETAILS_PER_RUN", "300"))
# Workday rate-limits by client across all its customers' sites, so cap requests to Workday as a whole.
_WORKDAY = asyncio.Semaphore(int(os.environ.get("WORKDAY_CONCURRENCY", "6")))


def parse_token(token: str) -> tuple[str, str, str]:
    tenant, wd, site = token.split("|")
    return tenant, wd, site


def posted_from(text: str, now: datetime) -> datetime:
    t = (text or "").lower()
    if "today" in t:
        return now
    if "yesterday" in t:
        return now - timedelta(days=1)
    m = re.search(r"(\d+)\+?\s*day", t)
    return now - timedelta(days=int(m.group(1))) if m else now


def _location(loc: str) -> str:
    return "" if re.match(r"^\d+ locations?$", loc.strip(), re.I) else loc


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    tenant, wd, site = parse_token(company.token)
    base = f"https://{tenant}.{wd}.myworkdayjobs.com"
    api = f"{base}/wday/cxs/{tenant}/{site}"
    now = datetime.now(timezone.utc)

    listed: list[dict] = []
    offset, total = 0, None
    while offset < MAX_JOBS:
        async with _WORKDAY:
            data = await http.post_json(f"{api}/jobs", {"appliedFacets": {}, "limit": PAGE, "offset": offset, "searchText": ""})
        posts = data.get("jobPostings") or []
        if total is None:
            total = int(data.get("total") or 0)
        listed.extend(p for p in posts if p.get("externalPath") and p.get("title"))
        offset += PAGE
        if not posts or offset >= (total or 0):
            break

    from ..normalize import job_id  # imported here to avoid a cycle (normalize imports models, not sources)

    described = company.described or set()
    budget = DETAILS_PER_RUN

    async def one(p: dict) -> RawJob:
        nonlocal budget
        path = p["externalPath"]
        req = (p.get("bulletFields") or [path.rsplit("_", 1)[-1]])[0]
        raw = RawJob(
            external_id=str(req or path),
            title=p["title"].strip(),
            job_url=f"{base}/en-US/{site}{path}",
            apply_url=f"{base}/en-US/{site}{path}",
            location_text=_location(p.get("locationsText", "")),
            posted_at=posted_from(p.get("postedOn", ""), now),
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget <= 0:
            return raw
        budget -= 1
        try:
            async with _WORKDAY:
                d = (await http.json(f"{api}{path}")).get("jobPostingInfo") or {}
        except Exception:
            return raw
        raw.description = html_to_text(d.get("jobDescription"))[:20000]
        raw.location_text = d.get("location") or raw.location_text
        raw.extra_locations = list(d.get("additionalLocations") or [])[:5]
        country = (d.get("country") or {}).get("descriptor") or ""
        if country and country not in raw.location_text:
            raw.location_text = f"{raw.location_text}, {country}" if raw.location_text else country
        if d.get("startDate"):
            try:
                raw.posted_at = datetime.fromisoformat(d["startDate"]).replace(tzinfo=timezone.utc)
            except ValueError:
                pass
        if d.get("externalUrl"):
            raw.job_url = raw.apply_url = d["externalUrl"]
        remote = (d.get("remoteType") or "").lower()
        raw.workplace_hint = "remote" if "remote" in remote else "hybrid" if "hybrid" in remote else None
        return raw

    return list(await asyncio.gather(*(one(p) for p in listed)))
