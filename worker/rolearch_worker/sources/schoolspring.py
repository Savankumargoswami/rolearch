"""SchoolSpring (PowerSchool's K-12 job board, where school districts post their own openings).

api.schoolspring.com/api/Jobs/GetPagedJobsWithSearch lists every open job (title, district, location, date), 500 at a
time; /api/Jobs/{id} adds the description and the district's own job page, fetched at most DETAILS_PER_RUN per run.
One feed carries many employers, so each job names its district. Jobs from districts we already read through AppliTrack
are skipped, and so are staffing agencies that post here.
"""

from __future__ import annotations

import asyncio
import csv
import os
import re
from pathlib import Path

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

API = "https://api.schoolspring.com/api/Jobs"
SITE = "www.schoolspring.com"
PER_PAGE = 500
DETAILS_PER_RUN = int(os.environ.get("SCHOOLSPRING_DETAILS_PER_RUN", "400"))
_AGENCY = re.compile(r"staffing|recruit|placement|temps?\b|personnel services", re.I)
_SEARCH = "keyword=&location=&category=&gradelevel=&jobtype=&organization=&swLat=&swLon=&neLat=&neLon="


def _norm(name: str) -> str:
    return re.sub(r"[^a-z0-9]", "", name.lower())


def _applitrack_districts() -> set[str]:
    """Names of districts we already read straight from AppliTrack."""
    path = Path(__file__).resolve().parents[2] / "companies" / "companies.csv"
    try:
        return {_norm(r["name"]) for r in csv.DictReader(open(path, encoding="utf-8")) if r.get("ats") == "applitrack"}
    except OSError:
        return set()


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    skip = _applitrack_districts()
    jobs: dict[str, RawJob] = {}
    page = 1
    while True:
        data = await http.json(f"{API}/GetPagedJobsWithSearch?domainName={SITE}&{_SEARCH}&page={page}&size={PER_PAGE}&sortDateAscending=false")
        rows = ((data or {}).get("value") or {}).get("jobsList") or []
        for j in rows:
            employer = str(j.get("employer") or "").strip()
            if not employer or _AGENCY.search(employer) or _norm(employer) in skip:
                continue
            jid = str(j.get("jobId") or "")
            if not jid or jid in jobs:
                continue
            url = f"https://{SITE}/jobs?jobid={jid}"
            jobs[jid] = RawJob(
                external_id=jid,
                title=str(j.get("title") or "").strip(),
                job_url=url,
                apply_url=url,
                location_text=str(j.get("location") or ""),
                country_hint="US",
                posted_at=parse_time(j.get("displayDate")),
                company_name=employer,
                category_hint="Education",
            )
        if len(rows) < PER_PAGE:
            break
        page += 1

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)

    async def detail(raw: RawJob) -> None:
        nonlocal budget
        if job_id(company, raw) in described:
            raw.touch_only = True
            return
        if budget <= 0:
            return
        budget -= 1
        async with sem:
            try:
                info = ((await http.json(f"{API}/{raw.external_id}?domainName={SITE}")).get("value") or {}).get("jobInfo") or {}
            except Exception:
                return
        raw.description = html_to_text(info.get("jobDescription"))[:20000]
        own = str(info.get("infoURL") or "")
        if own.startswith("http"):
            raw.apply_url = own  # the district's own posting

    await asyncio.gather(*(detail(r) for r in jobs.values()))
    return list(jobs.values())
