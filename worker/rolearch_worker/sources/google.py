"""Google careers (Google, DeepMind, YouTube, ...).

Token: unused ("all"). Job URLs come from Google's published job sitemap; each job page carries the job
in its page data (title, Google company, places, responsibilities, qualifications, posting time). Search
results pages are disallowed in robots.txt, so we never page through search; job pages are allowed.
A run reads at most DETAILS_PER_RUN new job pages; jobs we have stay open while they're in the sitemap.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

SITEMAP = "https://www.google.com/about/careers/applications/jobs/sitemap.xml"
BASE = "https://www.google.com/about/careers/applications/jobs/results/"
DETAILS_PER_RUN = int(os.environ.get("GOOGLE_DETAILS_PER_RUN", "400"))
_DATA = re.compile(r"AF_initDataCallback\(\{key: 'ds:0'.*?data:(.*?), sideChannel", re.S)


def _html(v) -> str:
    return v[1] if isinstance(v, list) and len(v) > 1 and isinstance(v[1], str) else ""


def parse(page: str) -> dict | None:
    m = _DATA.search(page)
    if not m:
        return None
    try:
        job = json.loads(m.group(1))[0]
    except (ValueError, IndexError, TypeError):
        return None
    return job if isinstance(job, list) and len(job) > 12 and isinstance(job[1], str) else None


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    sm = await http.get(SITEMAP)
    sm.raise_for_status()
    slugs = list(dict.fromkeys(re.findall(r"/jobs/results/(\d+-[^/<\s]+)/?", sm.text)))
    known = company.known_urls or {}
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(slug: str) -> RawJob | None:
        nonlocal budget
        url = BASE + slug
        jid = slug.split("-", 1)[0]
        if url in known:
            return RawJob(external_id=jid, title=known[url], job_url=url, apply_url=url, touch_only=True)
        if budget <= 0:
            return None
        budget -= 1
        try:
            async with sem:
                r = await http.get(url, attempts=2)
            job = parse(r.text) if r.status_code == 200 else None
        except Exception:
            return None
        if not job:
            return None
        places = job[9] if isinstance(job[9], list) else []
        first = places[0] if places and isinstance(places[0], list) else []
        posted = None
        if isinstance(job[12], list) and job[12] and isinstance(job[12][0], int):
            posted = datetime.fromtimestamp(job[12][0], tz=timezone.utc)
        text = "\n\n".join(x for x in (_html(job[10]), _html(job[3]), _html(job[4]), _html(job[19]) if len(job) > 19 else "") if x)
        return RawJob(
            external_id=jid,
            title=job[1].strip(),
            job_url=url,
            apply_url=url,
            location_text=first[0] if first else "",
            city_hint=first[2] if len(first) > 2 else None,
            country_hint=first[5] if len(first) > 5 and isinstance(first[5], str) else None,
            extra_locations=[p[0] for p in places[1:6] if isinstance(p, list) and p],
            posted_at=posted,
            description=html_to_text(text)[:20000],
            company_name=job[7] if isinstance(job[7], str) and job[7] else None,
        )

    return [r for r in await asyncio.gather(*(one(s) for s in slugs)) if r]
