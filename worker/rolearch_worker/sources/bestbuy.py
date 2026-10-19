"""Best Buy jobs (jobs.bestbuy.com, a ServiceNow career portal).

Token: unused ("all"). Job ids come from the portal's sitemap; each job's details (title, place, pay,
schedule, description) come from the portal's page API for that job, read for up to DETAILS_PER_RUN new
jobs a run; jobs we already have stay open while they remain in the sitemap. Links go to the job's page
on jobs.bestbuy.com.
"""

from __future__ import annotations

import asyncio
import html
import os
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text

SITEMAP = "https://bestbuy.service-now.com/api/93622/seo/sitemap"
PAGE_API = "https://jobs.bestbuy.com/api/now/sp/page"
PORTAL = "c5f6902e1b91b850b4c011f18c4bcbf5"
DETAILS_PER_RUN = int(os.environ.get("BESTBUY_DETAILS_PER_RUN", "400"))


def _job(data: dict) -> dict:
    """The 'job' object of the Best Buy Career Job Details widget."""
    for container in (data.get("result") or {}).get("containers") or []:
        for row in container.get("rows") or []:
            for col in row.get("columns") or []:
                for w in col.get("widgets") or []:
                    job = ((w.get("widget") or {}).get("data") or {}).get("job")
                    if isinstance(job, dict) and job.get("title"):
                        return job
    return {}


def _date(s: str) -> datetime | None:
    try:
        return datetime.strptime(s, "%d-%b-%Y").replace(tzinfo=timezone.utc)
    except (TypeError, ValueError):
        return None


def _url(req: str) -> str:
    return f"https://jobs.bestbuy.com/bby?id=job_details&req_id={req}"


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    sm = await http.get(SITEMAP)
    sm.raise_for_status()
    reqs = list(dict.fromkeys(re.findall(r"req_id=([A-Za-z0-9]+)", html.unescape(sm.text))))
    known = company.known_urls or {}
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(req: str) -> RawJob | None:
        nonlocal budget
        url = _url(req)
        if url in known:
            return RawJob(external_id=req, title=known[url], job_url=url, apply_url=url, touch_only=True)
        if budget <= 0:
            return None
        budget -= 1
        try:
            async with sem:
                job = _job(await http.json(PAGE_API, params={"id": "job_details", "req_id": req, "portal_id": PORTAL}))
        except Exception:
            return None
        if not job:
            return None
        salary = None
        try:
            lo, hi = float(job.get("pay_min") or 0), float(job.get("pay_max") or 0)
            if lo and hi:
                salary = Salary(lo, hi, job.get("pay_currency") or "USD", "hour" if "/hr" in (job.get("pay_range") or "") else "year")
        except ValueError:
            pass
        parts = [job.get("job_description_dv") or job.get("job_description") or ""]
        if job.get("type"):
            parts.append(f"<p>Schedule: {job['type']}</p>")
        return RawJob(
            external_id=req,
            title=job["title"].strip(),
            job_url=url,
            apply_url=url,
            location_text=", ".join(x for x in (job.get("city"), job.get("state"), job.get("country")) if x),
            city_hint=job.get("city") or None,
            workplace_hint="remote" if str(job.get("remote_eligible", "")).lower() in ("true", "yes") else None,
            posted_at=_date(job.get("last_updated") or ""),
            description=html_to_text("".join(parts))[:20000],
            salary=salary,
            department=job.get("category") or "",
        )

    return [r for r in await asyncio.gather(*(one(q) for q in reqs)) if r]
