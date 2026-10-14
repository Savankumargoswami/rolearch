"""Pull every company's board, normalize, store, close jobs that disappeared."""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections import Counter
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from .http import Fetcher
from .models import Company
from .normalize import normalize
from .sources import PROBE_ORDER, SOURCES
from .store import DROP_GUARD, Store

log = logging.getLogger(__name__)

LINK_CHECKS = 3


async def link_dead(http: Fetcher, url: str) -> bool:
    """True only for a definite 404/410. Timeouts and bot-blocking (403) don't count as dead."""
    try:
        r = await http.get(url, attempts=1)
    except Exception:
        return False
    return r.status_code in (404, 410)


@dataclass
class Result:
    company: Company
    total: int = 0
    launch: int = 0
    added: int = 0
    closed: int = 0
    error: str = ""


async def pull_one(http: Fetcher, store: Store, company: Company) -> Result:
    res = Result(company)
    source = SOURCES.get(company.ats)
    if not source:
        res.error = f"unknown ats '{company.ats}'"
        store.record_error(company, res.error)
        return res
    try:
        raws = await source(http, company)
    except Exception as e:  # one broken board never stops the run
        res.error = f"{type(e).__name__}: {e}"[:300]
        store.record_error(company, res.error)
        return res

    now = datetime.now(timezone.utc)
    jobs, keys = [], set()
    for raw in raws:
        job = normalize(company, raw, now)
        if job and job["dedupeKey"] not in keys:  # same title + place posted twice -> keep one
            keys.add(job["dedupeKey"])
            jobs.append(job)

    previous = store.previous_count(company)
    if not jobs and previous >= DROP_GUARD:
        res.error = f"board returned 0 jobs but had {previous}; kept them open (check the feed)"
        store.record_error(company, res.error)
        return res

    # A board can keep serving postings whose pages are gone (abandoned ATS account).
    # Spot-check a few new jobs' apply links; if every one is dead, don't import the board.
    known = store.known_ids(company)
    new = [j for j in jobs if j["id"] not in known][:LINK_CHECKS]
    if new and all(await asyncio.gather(*(link_dead(http, j["applyUrl"]) for j in new))):
        res.error = f"apply links are dead ({len(new)} checked); board looks abandoned, not imported"
        store.record_error(company, res.error)
        return res

    res.total, res.launch = len(jobs), sum(j["launchField"] for j in jobs)
    res.added, _, res.closed = store.save(company, jobs)
    return res


async def pull_all(companies: list[Company], store: Store, concurrency: int = 8) -> list[Result]:
    sem = asyncio.Semaphore(concurrency)
    async with Fetcher() as http:

        async def task(c: Company) -> Result:
            async with sem:
                r = await pull_one(http, store, c)
                status = f"ERROR {r.error}" if r.error else f"{r.total} jobs ({r.launch} data/ML), +{r.added} new, {r.closed} closed"
                log.info("%-28s %-15s %s", c.name[:28], c.ats, status)
                return r

        return await asyncio.gather(*(task(c) for c in companies))


async def probe(http: Fetcher, name: str, country: str, slugs: list[str], careers_url: str) -> Company | None:
    """Find which ATS hosts this company's board: first (ats, slug) that returns at least one job."""
    for slug in slugs:
        for ats in PROBE_ORDER:
            c = Company(name, country, ats, slug, careers_url)
            try:
                if await SOURCES[ats](http, c):
                    return c
            except Exception:
                continue
    if careers_url:
        c = Company(name, country, "jsonld", slug_of(name), careers_url)
        try:
            if await SOURCES["jsonld"](http, c):
                return c
        except Exception:
            pass
    return None


def slug_of(name: str) -> str:
    return "".join(ch for ch in name.lower() if ch.isalnum())


async def discover(candidates, concurrency: int = 6) -> tuple[list[Company], list[str]]:
    sem = asyncio.Semaphore(concurrency)
    found, missing = [], []
    async with Fetcher() as http:

        async def task(row):
            name, country, slugs, url = row
            async with sem:
                c = await probe(http, name, country, slugs or [slug_of(name)], url)
            if c:
                found.append(c)
                log.info("found   %-28s %s:%s", name, c.ats, c.token)
            else:
                missing.append(name)
                log.info("missing %-28s tried %s", name, ", ".join(slugs or [slug_of(name)]))

        await asyncio.gather(*(task(r) for r in candidates))
    return found, missing


FULL = [
    "id", "title", "company", "city", "country", "countryCode", "region", "workplace", "visa", "salary", "level",
    "years", "skills", "nice", "postedAt", "postedDaysAgo", "source", "summary", "duties", "jobUrl", "applyUrl", "lat", "lon",
]
# What the search page needs in the browser; everything else stays on the server.
LITE = ["id", "title", "company", "city", "country", "region", "workplace", "visa", "salary", "level", "years", "skills", "postedDaysAgo"]


def export_feed(store: Store, path: Path, limit: int) -> int:
    """Write the site's feed: <path> (full records, server only) and <path>-index (compact, for the search page)."""
    jobs = store.open_jobs(launch_only=True, limit=limit)
    meta = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "companies": len({j["company"] for j in jobs}),
        "countries": len({j["countryCode"] for j in jobs if j.get("countryCode")}),
    }
    path.parent.mkdir(parents=True, exist_ok=True)
    full = {**meta, "jobs": [{k: j.get(k) for k in FULL} for j in jobs]}
    lite = {**meta, "jobs": [{k: j.get(k) for k in LITE} for j in jobs]}
    path.write_text(json.dumps(full, ensure_ascii=False, separators=(",", ":")), "utf-8")
    path.with_name(f"{path.stem}-index{path.suffix}").write_text(json.dumps(lite, ensure_ascii=False, separators=(",", ":")), "utf-8")
    path.with_name(f"{path.stem}-suggest{path.suffix}").write_text(
        json.dumps({"terms": suggestion_terms(jobs)}, ensure_ascii=False, separators=(",", ":")), "utf-8"
    )
    return len(jobs)


_seniority = re.compile(r"^(senior|sr\.?|staff|principal|lead|junior|jr\.?|associate|head of|director,?)\s+", re.I)


def suggestion_terms(jobs: list[dict], titles: int = 120) -> list[str]:
    """Small list for search-as-you-type: common role titles, skills and companies (not every posting)."""
    counts: Counter[str] = Counter()
    for j in jobs:
        core = re.split(r"\s*[,(|–—-]\s+|\s+\(", j["title"])[0].strip()
        while _seniority.match(core):
            core = _seniority.sub("", core, count=1).strip()
        core = re.sub(r"\s+(I{1,3}|IV|\d)$", "", core)  # "Data Scientist II" -> "Data Scientist"
        if 2 < len(core) <= 40 and " " in core:  # single words ("Manager") are too vague to suggest
            counts[core.title() if core.islower() else core] += 1
    top = [t for t, n in counts.most_common(titles) if n >= 2]
    skills = sorted({s for j in jobs for s in j.get("skills") or []})
    companies = sorted({j["company"] for j in jobs})
    return list(dict.fromkeys([*top, *skills, *companies]))
