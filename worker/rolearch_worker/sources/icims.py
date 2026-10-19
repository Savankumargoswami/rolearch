"""Classic iCIMS job portals ({portal}.icims.com/jobs/search).

Token: the portal name, e.g. "careers-rambus". The search pages list jobs 20-50 at a time; each job's
page carries schema.org JobPosting data (place, date, description), read for up to DETAILS_PER_RUN new
jobs per run. Companies that front iCIMS with a Jibe career site use the jibe reader instead.
"""

from __future__ import annotations

import asyncio
import html
import json
import os
import re

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

MAX_PAGES = 100
DETAILS_PER_RUN = int(os.environ.get("ICIMS_DETAILS_PER_RUN", "300"))
_LINK = re.compile(r'href="(https://[^"]+?/jobs/(\d+)/[^"/]+/job)[^"]*"[^>]*>(.*?)</a>', re.S)
_LD = re.compile(r'<script[^>]+application/ld\+json[^>]*>(.*?)</script>', re.S)


def _clean(s: str) -> str:
    # Portals put a hidden "Title" / "Job Title" label for screen readers inside the link; drop it.
    s = re.sub(r"<(span|div)[^>]*(sr-only|field-label)[^>]*>.*?</(span|div)>", " ", s, flags=re.S)
    text = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()
    return re.sub(r"^(Job\s+)?Title\s*:?\s+", "", text, flags=re.I)


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    base = f"https://{company.token.strip().lower()}.icims.com"
    found: dict[str, tuple[str, str]] = {}
    for page in range(MAX_PAGES):
        r = await http.get(f"{base}/jobs/search", params={"ss": "1", "pr": str(page), "in_iframe": "1"})
        if r.status_code != 200:
            break
        new = 0
        for url, jid, inner in _LINK.findall(r.text):
            title = re.sub(r"\s+", " ", _clean(inner))
            if title and jid not in found:
                found[jid] = (url.split("?")[0], title)
                new += 1
        if not new:
            break

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(jid: str, url: str, title: str) -> RawJob:
        nonlocal budget
        raw = RawJob(external_id=jid, title=title, job_url=url, apply_url=url)
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget <= 0:
            return raw
        budget -= 1
        try:
            async with sem:
                page = (await http.get(url, params={"in_iframe": "1"})).text
            for block in _LD.findall(page):
                data = json.loads(block)
                if isinstance(data, list):
                    data = next((d for d in data if d.get("@type") == "JobPosting"), {})
                if data.get("@type") != "JobPosting":
                    continue
                loc = data.get("jobLocation")
                loc = loc[0] if isinstance(loc, list) and loc else loc or {}
                addr = (loc.get("address") or {}) if isinstance(loc, dict) else {}
                raw.location_text = ", ".join(x for x in (addr.get("addressLocality"), addr.get("addressRegion"), addr.get("addressCountry")) if isinstance(x, str) and x)
                country = addr.get("addressCountry")
                raw.country_hint = country.upper() if isinstance(country, str) and len(country) == 2 else None
                raw.city_hint = addr.get("addressLocality") or None
                raw.posted_at = parse_time(data.get("datePosted"))
                raw.description = html_to_text(data.get("description"))[:20000]
                break
        except Exception:
            pass
        return raw

    return list(await asyncio.gather(*(one(jid, url, title) for jid, (url, title) in found.items())))
