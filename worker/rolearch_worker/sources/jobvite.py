"""Jobvite career pages: jobs.jobvite.com/{company}/jobs lists every opening (title, location, team);
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

DETAILS_PER_RUN = int(os.environ.get("JOBVITE_DETAILS_PER_RUN", "200"))
_TEAM = re.compile(r'<h3 class="h2">(.*?)</h3>', re.S)
_ROW = re.compile(
    r'<a href="(/[^/"]+/job/([A-Za-z0-9]+))"[^>]*>\s*<div class="jv-job-list-name[^"]*">(.*?)</div>\s*'
    r'<div class="[^"]*jv-job-list-location[^"]*">(.*?)</div>',
    re.S,
)


def _txt(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    page = (await http.get(f"https://jobs.jobvite.com/{company.token}/jobs")).text
    # Each team heading is followed by its jobs; remember the latest heading before each job link.
    heads = [(m.start(), _txt(m.group(1))) for m in _TEAM.finditer(page)]
    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    def team_at(pos: int) -> str:
        team = ""
        for start, name in heads:
            if start > pos:
                break
            team = name
        return team

    async def one(pos: int, path: str, jid: str, title: str, where: str) -> RawJob:
        nonlocal budget
        url = f"https://jobs.jobvite.com{path}"
        raw = RawJob(
            external_id=jid,
            title=_txt(title),
            job_url=url,
            apply_url=f"{url}/apply",
            location_text=_txt(where),
            department=team_at(pos),
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

    rows = {m.group(2): (m.start(), *m.groups()) for m in _ROW.finditer(page)}
    return list(await asyncio.gather(*(one(*r) for r in rows.values())))
