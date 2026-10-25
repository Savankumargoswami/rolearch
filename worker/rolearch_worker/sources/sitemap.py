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
import json
import logging
import os
from collections import Counter
import re
from datetime import datetime, timedelta, timezone
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser

from ..http import USER_AGENT, Fetcher
from ..models import Company, RawJob
from .jsonld import _postings, _to_raw

log = logging.getLogger(__name__)

DETAILS_PER_RUN = int(os.environ.get("SITEMAP_DETAILS_PER_RUN", "1500"))
MAX_SITEMAPS = 40
_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>", re.I)
_JOB_URL = re.compile(r"/(jobs?|job-details|jobdetail|careers?/jobs?|positions?|requisitions?|opening)/", re.I)
_SKIP = re.compile(r"/(search|category|categories|location|locations|teams?|benefits|blog|events?)(/|$)|\.(pdf|jpg|png)$", re.I)


_NEXT = re.compile(r"<script id=[\"']?__NEXT_DATA__[\"']?[^>]*>(.*?)</script>", re.S)
_PERIOD = {"hourly": "HOUR", "annual": "YEAR", "yearly": "YEAR", "salaried": "YEAR", "monthly": "MONTH"}


def _next_posting(html: str) -> dict | None:
    """Walmart's job pages carry no schema.org data; the same job is in the page's Next.js data as jobDetails.
    Returns it shaped as a JobPosting, or None (also for requisitions that aren't open)."""
    m = _NEXT.search(html)
    if not m:
        return None
    try:
        job = json.loads(m.group(1)).get("props", {}).get("pageProps", {}).get("jobDetails")
    except (json.JSONDecodeError, AttributeError):
        return None
    if not isinstance(job, dict) or not (job.get("jobPostingTitle") or job.get("title")):
        return None
    if ((job.get("requisitionStatus") or {}).get("id") or "OPEN").upper() != "OPEN":
        return None
    loc = job.get("primaryLocation") or {}
    post = {
        "title": job.get("jobPostingTitle") or job.get("title"),
        "description": job.get("jobPostingDescription") or job.get("description") or "",
        "datePosted": job.get("jobPostingStartDate") or job.get("createdAt"),
        "identifier": job.get("jobId"),
        "jobLocation": {"address": {"addressLocality": (loc.get("city") or "").title(), "addressRegion": loc.get("stateCode") or loc.get("state"),
                                    "addressCountry": loc.get("countryCode") or loc.get("country")}},
    }
    pay = (job.get("payRange") or [{}])[0]
    currency = (((job.get("payPlanData") or {}).get("currencyReference") or {}).get("currencyId"))
    unit = _PERIOD.get(str(job.get("payFrequency") or "").lower())
    try:
        lo, hi = float(pay.get("min") or 0), float(pay.get("max") or 0)
    except (TypeError, ValueError):
        lo = hi = 0
    if lo > 0 and hi >= lo and currency and unit:
        post["baseSalary"] = {"currency": currency, "value": {"minValue": lo, "maxValue": hi, "unitText": unit}}
    return post


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
            statuses[r.status_code] += 1
            if r.status_code != 429:
                return r
            pause = min(max(pause * 2, 2.0), 30.0)
        return r

    known = company.known_urls or {}
    statuses: Counter[int] = Counter()

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
            if not posts and (nxt := _next_posting(r.text)):
                posts = [nxt]
            if not posts:
                return None
            valid = str(posts[0].get("validThrough") or "")[:10]
            if valid and valid < datetime.now(timezone.utc).strftime("%Y-%m-%d"):
                return None  # the sitemap still lists a posting that has expired
            raw = _to_raw(posts[0], url)
            # A template date years old (Home Depot's pages all say 2016) isn't the posting date: use first seen.
            if raw.posted_at and raw.posted_at < datetime.now(timezone.utc) - timedelta(days=730):
                raw.posted_at = None
            raw.external_id = urlsplit(url).path
            raw.job_url = raw.apply_url = url
            raw.description = raw.description[:20000]
            if job_id(company, raw) in described:
                raw.touch_only = True
            return raw
        except Exception:
            return None

    out = [r for r in await asyncio.gather(*(one(u) for u in urls)) if r]
    # One line per board, so a host that blocks or throttles us shows up in the run log (e.g. {403: 1500}).
    log.info("sitemap %s: %d job pages listed, %d new read, responses %s", origin, len(urls), sum(1 for r in out if not r.touch_only), dict(statuses))
    return out
