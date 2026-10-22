"""JazzHR career pages: {company}.applytojob.com/apply lists every opening (title, location, department);
each job page carries a schema.org JobPosting with the description, fetched at most DETAILS_PER_RUN per run.
"""

from __future__ import annotations

import asyncio
import html
import os
import re

from ..http import Fetcher
from ..models import Company, RawJob
from .jsonld import _postings, _to_raw

DETAILS_PER_RUN = int(os.environ.get("JAZZHR_DETAILS_PER_RUN", "200"))
_ROW = re.compile(
    r"<a href=\"(https://[^\"]+\.applytojob\.com/apply/([A-Za-z0-9]+)/[^\"]*)\">\s*(.*?)\s*</a>\s*</h3>\s*"
    r"<ul class='list-inline list-group-item-text'>(.*?)</ul>",
    re.S,
)
_LI = re.compile(r"<li><i class='fa fa-([a-z-]+)'></i>(.*?)</li>", re.S)


def _txt(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    page = (await http.get(f"https://{company.token}.applytojob.com/apply")).text
    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(url: str, jid: str, title: str, meta: str) -> RawJob:
        nonlocal budget
        info = {k: _txt(v) for k, v in _LI.findall(meta)}
        raw = RawJob(
            external_id=jid,
            title=_txt(title),
            job_url=url,
            apply_url=url,
            location_text=info.get("map-marker", ""),
            department=info.get("sitemap", ""),
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            async with sem:
                try:
                    found = _postings((await http.get(url)).text)
                except Exception:
                    return raw
            if found:
                full = _to_raw(found[0], url)
                raw.description, raw.posted_at, raw.salary = full.description[:20000], full.posted_at, full.salary
                raw.workplace_hint = full.workplace_hint
        return raw

    rows = {m[1]: m for m in _ROW.findall(page)}
    return list(await asyncio.gather(*(one(*m) for m in rows.values())))
