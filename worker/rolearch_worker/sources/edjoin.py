"""EdJoin (edjoin.org): California's K-12 and county-office job board, where districts post their own openings.

Its sitemap lists every open posting (www.edjoin.org/sitemap.xml -> /sitemap/jobs/1) and each job page carries
schema.org JobPosting data with the district as hiringOrganization. One board carries many employers, so each job
names its district. A run reads at most DETAILS_PER_RUN new job pages; jobs we already have stay open while the
sitemap still lists them. Districts we already read through AppliTrack are skipped, and so are staffing agencies.
"""

from __future__ import annotations

import asyncio
import logging
import os
import re
from collections import Counter
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit

from ..http import USER_AGENT, Fetcher
from ..models import Company, RawJob
from .jsonld import _postings, _to_raw
from .schoolspring import _AGENCY, _applitrack_districts, _norm
from .sitemap import _robots, job_urls

log = logging.getLogger(__name__)

ORIGIN = "https://www.edjoin.org"
DETAILS_PER_RUN = int(os.environ.get("EDJOIN_DETAILS_PER_RUN", "1500"))
_JOB = re.compile(r"/Home/JobPosting/\d+$", re.I)


def employer_of(posting: dict) -> str:
    org = posting.get("hiringOrganization")
    if isinstance(org, list):
        org = org[0] if org else {}
    return str((org or {}).get("name") or "").strip() if isinstance(org, dict) else str(org or "").strip()


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    rp, _ = await _robots(http, ORIGIN)
    failed: list[str] = []
    urls = [u for u in await job_urls(http, f"{ORIGIN}/sitemap.xml", _JOB, failed) if rp.can_fetch(USER_AGENT, u)]
    company.partial = bool(failed)  # an unreadable sitemap file: keep the jobs we didn't see open
    if len(urls) < 1000:  # normally ~15,000: a short list is a failed read, and would close real jobs
        raise RuntimeError(f"edjoin sitemap listed only {len(urls)} job pages")

    skip = _applitrack_districts()
    known = company.known_urls or {}
    employers = company.known_employers or {}
    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)
    statuses: Counter[int] = Counter()
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async def one(url: str) -> RawJob | None:
        nonlocal budget
        path = urlsplit(url).path
        if url in known and employers.get(url):  # already stored: keep it open without re-reading the page
            return RawJob(external_id=path, title=known[url], job_url=url, apply_url=url, company_name=employers[url], touch_only=True)
        if budget <= 0:
            return None
        budget -= 1
        try:
            async with sem:
                r = await http.client.get(url)
            statuses[r.status_code] += 1
            if r.status_code != 200:
                return None
            posts = _postings(r.text)
            if not posts:
                return None
            p = posts[0]
            valid = str(p.get("validThrough") or "")[:10]
            if valid and valid < today:
                return None
            employer = employer_of(p)
            if not employer or _AGENCY.search(employer) or _norm(employer) in skip:
                return None
            raw = _to_raw(p, url)
            if raw.posted_at and raw.posted_at < datetime.now(timezone.utc) - timedelta(days=730):
                raw.posted_at = None
            raw.external_id = path
            raw.job_url = raw.apply_url = url
            raw.company_name = employer
            raw.country_hint = raw.country_hint or "US"
            raw.category_hint = "Education"
            raw.description = raw.description[:20000]
            if job_id(company, raw) in described:
                raw.touch_only = True
            return raw
        except Exception:
            return None

    out = [r for r in await asyncio.gather(*(one(u) for u in urls)) if r]
    log.info("edjoin: %d job pages listed, %d new read, responses %s", len(urls), sum(1 for r in out if not r.touch_only), dict(statuses))
    return out
