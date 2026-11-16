"""Every Hireology career site at once (careers.hireology.com): car dealers, home care, fitness and childcare franchises.

The sitemap lists every open job as /{site}/{job id}/description, about 48,000 across 9,000 sites. Jobs we already have
stay open while the sitemap still lists them; for a site with jobs we haven't read, the public API
(api.hireology.com/v2/public/careers/{site}) gives them with pay and locations. Each job names its own employer
(organization), so one board carries many employers, like EdJoin. A run makes at most CALLS_PER_RUN API calls.
Sites we already read as their own company (ats "hireology"), staffing agencies and "general application" posts are skipped.
"""

from __future__ import annotations

import asyncio
import csv
import logging
import os
import re
from collections import Counter, defaultdict
from pathlib import Path

from ..http import Fetcher
from ..models import Company, RawJob
from .hireology import _to_raw, jobs
from .schoolspring import _AGENCY
from .sitemap import job_urls

log = logging.getLogger(__name__)

SITEMAP = "https://careers.hireology.com/sitemap.xml"
CALLS_PER_RUN = int(os.environ.get("HIREOLOGY_CALLS_PER_RUN", "2500"))
MIN_LISTED = 10000  # normally ~48,000: a short list is a failed read, and would close real jobs
_JOB = re.compile(r"careers\.hireology\.com/([^/?#]+)/(\d+)/description$", re.I)
_NOT_A_JOB = re.compile(r"general (application|interest)|talent (pool|community|network)|future (opportunit|opening)|join our team$|^resume", re.I)


def _own_sites() -> set[str]:
    """Hireology sites already read as their own company."""
    path = Path(__file__).resolve().parents[2] / "companies" / "companies.csv"
    try:
        return {r["token"].lower() for r in csv.DictReader(open(path, encoding="utf-8")) if r.get("ats") == "hireology"}
    except OSError:
        return set()


def _employer(j: dict) -> str:
    org = j.get("organization") if isinstance(j.get("organization"), dict) else {}
    return str(org.get("name") or "").strip()


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    failed: list[str] = []
    listed = await job_urls(http, SITEMAP, _JOB, failed)
    company.partial = bool(failed)  # an unreadable sitemap file: keep the jobs we didn't see open
    if len(listed) < MIN_LISTED:
        raise RuntimeError(f"hireology sitemap listed only {len(listed)} jobs")

    own = _own_sites()
    sites: dict[str, set[str]] = defaultdict(set)  # site -> job ids it lists
    for u in listed:
        m = _JOB.search(u)
        if m and m.group(1).lower() not in own:
            sites[m.group(1).lower()].add(m.group(2))
    listed_ids = {i for ids in sites.values() for i in ids}
    # A site we read on its own can include its child sites' jobs: leave those to it.
    sem = asyncio.Semaphore(4)

    async def own_ids(site: str) -> set[str]:
        try:
            async with sem:
                return {str(j.get("id")) for j in (await jobs(http, site))[1]}
        except Exception:
            return set()

    for ids in await asyncio.gather(*(own_ids(s) for s in sorted(own))):
        listed_ids -= ids

    # What we already have, by job id (the stored url can name a parent or child site).
    known: dict[str, tuple[str, str, str]] = {}  # id -> (url, title, employer)
    employers = company.known_employers or {}
    for url, title in (company.known_urls or {}).items():
        m = _JOB.search(url)
        if m and employers.get(url):
            known[m.group(2)] = (url, title, employers[url])

    out: list[RawJob] = []
    for jid in listed_ids & known.keys():
        url, title, employer = known[jid]
        out.append(RawJob(external_id=jid, title=title, job_url=url, apply_url=url, company_name=employer, touch_only=True))

    # A site needs reading when it lists a job newer than any we stored from it (ids only go up). Older unknown ids
    # are copies of a stored job (the newest copy is the one kept) or posts we skipped, so they don't count.
    # (A site whose newest post we skip, e.g. a "general application", is read again each run: a cheap call.)
    site_of = {i: s for s, ids in sites.items() for i in ids}
    top = {s: max((int(i) for i in ids if i in known), default=0) for s, ids in sites.items()}

    def fresh(site: str) -> set[str]:
        return {i for i in (sites[site] & listed_ids) - known.keys() if int(i) > top[site]}

    todo = sorted((s for s in sites if not _AGENCY.search(s) and fresh(s)), key=lambda s: -len(fresh(s)))
    calls = CALLS_PER_RUN
    seen: set[str] = set(known)
    stats: Counter[str] = Counter()

    async def one(site: str) -> list[dict]:
        try:
            async with sem:
                _, rows = await jobs(http, site)
            stats["sites read"] += 1
            return rows
        except Exception:
            stats["sites failed"] += 1
            return []

    batch = []
    for site in todo:
        if calls <= 0:
            break
        calls -= 1 + len(sites[site]) // 100  # a page per 100 jobs
        batch.append(site)
    for site, rows in zip(batch, await asyncio.gather(*(one(s) for s in batch))):
        for j in rows:
            jid = str(j.get("id") or "")
            if not jid or jid in seen or jid not in listed_ids:  # unlisted: an old or hidden posting
                continue
            if int(jid) <= top[site_of[jid]]:  # older than what we have from its site: a copy or a post we skipped
                continue
            seen.add(jid)
            employer, title = _employer(j), str(j.get("name") or "")
            if not employer or _AGENCY.search(employer):
                stats["agency"] += 1
                continue
            if _NOT_A_JOB.search(title):
                stats["not a job"] += 1
                continue
            raw = _to_raw(site, j)
            raw.company_name = employer
            out.append(raw)
            stats["new"] += 1
    # Newest first: when a job is posted twice, the copy kept is the newest, so the older copies never look new.
    out.sort(key=lambda r: (not r.touch_only, -int(r.external_id or 0)))
    log.info("hireology: %d jobs listed on %d sites, %d kept open, %d sites left to read, %s",
             len(listed_ids), len(sites), len(listed_ids & known.keys()), len(todo) - len(batch), dict(stats))
    return out
