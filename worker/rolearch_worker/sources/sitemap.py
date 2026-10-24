"""Career sites without a public jobs API, read through their sitemap (Walmart, UnitedHealth, Kaiser, ...).

Token: the sitemap URL, or the career site's host (then robots.txt's Sitemap: line or /sitemap.xml is used).
We follow sitemap indexes, keep URLs that look like job pages, and read schema.org JobPosting data from
each page (the same data the site publishes for Google for Jobs). Only pages robots.txt allows are read.
A job page is one request, so a run reads at most DETAILS_PER_RUN new pages per company; jobs we already
have are kept open while they stay in the sitemap.
"""

from __future__ import annotations

import asyncio
import gzip
import os
import re
from datetime import datetime, timezone
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from ..http import USER_AGENT, Fetcher
from ..models import Company, RawJob
from .jsonld import _postings, _to_raw

DETAILS_PER_RUN = int(os.environ.get("SITEMAP_DETAILS_PER_RUN", "1500"))
MAX_SITEMAPS = 40
_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
_JOB_URL = re.compile(r"/(jobs?|job-details|jobdetail|careers?/jobs?|positions?|requisitions?|opening)/", re.I)
_SKIP = re.compile(r"/(search|category|categories|location|locations|teams?|benefits|blog|events?)(/|$)|\.(pdf|jpg|png)$", re.I)


def _text(r) -> str:
    raw = r.content
    if raw[:2] == b"\x1f\x8b":
        raw = gzip.decompress(raw)
    return raw.decode("utf-8", "replace")


async def _robots(http: Fetcher, origin: str) -> tuple[RobotFileParser, list[str]]:
    rp = RobotFileParser()
    try:
        r = await http.get(f"{origin}/robots.txt", attempts=1)
        lines = r.text.splitlines() if r.status_code == 200 else []
    except Exception:
        lines = []
    rp.parse(lines)
    return rp, [m.group(1) for line in lines if (m := re.match(r"(?i)^\s*sitemap:\s*(\S+)", line))]


async def job_urls(http: Fetcher, start: str) -> list[str]:
    """Job page URLs from a sitemap, following sitemap indexes (breadth-first, capped)."""
    todo, seen, found = [start], set(), []
    while todo and len(seen) < MAX_SITEMAPS:
        url = todo.pop(0)
        if url in seen:
            continue
        seen.add(url)
        try:
            r = await http.get(url, attempts=2)
        except Exception:
            continue
        if r.status_code != 200:
            continue
        body = _text(r)
        locs = _LOC.findall(body)
        if "<sitemapindex" in body.lower():
            # Prefer child sitemaps that look job-related.
            locs.sort(key=lambda u: 0 if re.search(r"job|career|posting|requisition", u, re.I) else 1)
            todo.extend(locs)
            continue
        found.extend(u for u in locs if _JOB_URL.search(urlsplit(u).path) and not _SKIP.search(urlsplit(u).path))
    return list(dict.fromkeys(found))


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    token = company.token.strip()
    start = token if token.startswith("http") else None
    origin = f"{urlsplit(start).scheme}://{urlsplit(start).netloc}" if start else f"https://{token}"
    rp, listed = await _robots(http, origin)
    if not start:
        start = listed[0] if listed else f"{origin}/sitemap.xml"

    urls = [u for u in await job_urls(http, start) if rp.can_fetch(USER_AGENT, u)]

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)
    # Some career hosts rate-limit hard (429). After the first one, read one page at a time with a pause
    # that grows on each further 429, rather than losing every page of the run.
    slow = asyncio.Lock()
    pause = 0.0

    async def get(url: str):
        nonlocal pause, budget
        for _ in range(4):
            if pause >= 30:
                budget = 0  # still throttled at the longest pause: stop for this run
                return None
            if pause:
                async with slow:
                    await asyncio.sleep(pause)
                    r = await http.client.get(url)
            else:
                async with sem:
                    r = await http.client.get(url)
            if r.status_code != 429:
                return r
            pause = min(max(pause * 2, 2.0), 30.0)
        return r

    known = company.known_urls or {}

    async def one(url: str) -> RawJob | None:
        nonlocal budget
        # Already stored: keep it open without re-reading the page.
        if url in known:
            return RawJob(external_id=urlsplit(url).path, title=known[url], job_url=url, apply_url=url, touch_only=True)
        if budget <= 0:
            return None
        budget -= 1
        try:
            r = await get(url)
            if r is None or r.status_code != 200:
                return None
            posts = _postings(r.text)
            if not posts:
                return None
            valid = str(posts[0].get("validThrough") or "")[:10]
            if valid and valid < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                return None  # the sitemap still lists a posting that has expired
            raw = _to_raw(posts[0], url)
            raw.external_id = urlsplit(url).path
            raw.job_url = raw.apply_url = url
            raw.description = raw.description[:20000]
            if job_id(company, raw) in described:
                raw.touch_only = True
            return raw
        except Exception:
            return None

    return [r for r in await asyncio.gather(*(one(u) for u in urls)) if r]
