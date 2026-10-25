"""Eightfold career sites ({tenant}.eightfold.ai/careers, and companies' own domains that run on Eightfold).

Token format: "host|domain", e.g. "micron.eightfold.ai|micron.com" or "app.eightfold.ai|qualcomm.com".
Newer sites ("PCSX") answer /api/pcsx/search (10 jobs a request) with one detail request per job for
the description; older sites answer /api/apply/v2/jobs with descriptions included. We try the newer
one first. Apply goes to the job's page on the company's Eightfold career site.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

MAX_JOBS = int(os.environ.get("EIGHTFOLD_MAX_JOBS", "50000"))
DETAILS_PER_RUN = int(os.environ.get("EIGHTFOLD_DETAILS_PER_RUN", "300"))
_EIGHTFOLD = asyncio.Semaphore(int(os.environ.get("EIGHTFOLD_CONCURRENCY", "4")))


def _ts(v) -> datetime | None:
    try:
        return datetime.fromtimestamp(int(v), tz=timezone.utc) if v else None
    except (TypeError, ValueError, OSError):
        return None


def _workplace(v: str | None) -> str | None:
    v = (v or "").lower()
    return "remote" if "remote" in v else "hybrid" if "hybrid" in v else "onsite" if "onsite" in v else None


async def _get(http: Fetcher, url: str, params: dict) -> dict:
    async with _EIGHTFOLD:
        return await http.json(url, params=params)


async def _pcsx(http: Fetcher, company: Company, host: str, domain: str) -> list[RawJob] | None:
    first = await http.get(f"https://{host}/api/pcsx/search", params={"domain": domain, "start": 0, "sort_by": "timestamp"})
    if first.status_code != 200:
        return None
    data = first.json().get("data")
    if not isinstance(data, dict):
        return None
    total = min(int(data.get("count") or 0), MAX_JOBS)
    positions = list(data.get("positions") or [])
    starts = range(len(positions), total, max(1, len(positions) or 10))
    # Big boards (Starbucks: 2,000+ pages) throttle some requests; pages that fail or come back empty are retried,
    # slower, a few times, instead of silently losing their jobs.
    todo = list(starts)
    for attempt in range(4):
        if not todo:
            break
        if attempt:
            await asyncio.sleep(5 * attempt)
        pages = await asyncio.gather(
            *(_get(http, f"https://{host}/api/pcsx/search", {"domain": domain, "start": s, "sort_by": "timestamp"}) for s in todo),
            return_exceptions=True,
        )
        failed = []
        for s, p in zip(todo, pages):
            found = (p.get("data") or {}).get("positions") if isinstance(p, dict) and isinstance(p.get("data"), dict) else None
            if found:
                positions.extend(found)
            else:
                failed.append(s)
        todo = failed

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    seen: set[str] = set()

    async def one(p: dict) -> RawJob | None:
        nonlocal budget
        pid = str(p.get("id") or "")
        if not pid or pid in seen or not p.get("name"):
            return None
        seen.add(pid)
        url = f"https://{host}{p.get('positionUrl') or f'/careers/job/{pid}'}"
        locs = p.get("locations") or []
        raw = RawJob(
            external_id=pid,
            title=p["name"].strip(),
            job_url=url,
            apply_url=url,
            location_text=locs[0] if locs else "",
            extra_locations=locs[1:6],
            workplace_hint=_workplace(p.get("workLocationOption")),
            posted_at=_ts(p.get("postedTs") or p.get("creationTs")),
            department=p.get("department") or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget <= 0:
            return raw
        budget -= 1
        try:
            d = (await _get(http, f"https://{host}/api/pcsx/position_details", {"position_id": pid, "domain": domain, "hl": "en"})).get("data") or {}
            raw.description = html_to_text(d.get("jobDescription"))[:20000]
        except Exception:
            pass
        return raw

    return [r for r in await asyncio.gather(*(one(p) for p in positions)) if r]


async def _v2(http: Fetcher, host: str, domain: str) -> list[RawJob]:
    jobs: list[RawJob] = []
    start = 0
    while start < MAX_JOBS:
        data = await _get(http, f"https://{host}/api/apply/v2/jobs", {"domain": domain, "start": start, "num": 100, "sort_by": "timestamp"})
        positions = data.get("positions") or []
        for p in positions:
            if not p.get("id") or not p.get("name"):
                continue
            url = p.get("canonicalPositionUrl") or f"https://{host}/careers/job/{p['id']}"
            locs = p.get("locations") or ([p["location"]] if p.get("location") else [])
            jobs.append(
                RawJob(
                    external_id=str(p["id"]),
                    title=p["name"].strip(),
                    job_url=url,
                    apply_url=url,
                    location_text=locs[0] if locs else "",
                    extra_locations=locs[1:6],
                    workplace_hint=_workplace(p.get("work_location_option")),
                    posted_at=_ts(p.get("t_create")),
                    description=html_to_text(p.get("job_description"))[:20000],
                    department=p.get("department") or "",
                )
            )
        # Pages are a fixed size set by the site (often 10), whatever num says.
        start += len(positions)
        if not positions or start >= int(data.get("count") or 0):
            break
    return jobs


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host, domain = company.token.split("|")
    found = await _pcsx(http, company, host, domain)
    if found is not None and len(found) >= 100:
        return found
    # Sites part-way through moving to the newer search can show only a few jobs there; use whichever has more.
    try:
        older = await _v2(http, host, domain)
    except Exception:
        older = []
    return older if len(older) > len(found or []) else (found or [])
