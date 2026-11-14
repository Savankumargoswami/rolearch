"""Career sites on NAS Recruitment's Activate platform (jobs.rossstores.com, jobs.olivegarden.com, ...).

Token: the career site's host. /Search/SearchResults (the site's own search, with no place filter) lists
100 jobs a request with title, address and posting date; the description is on each job's page, read for
up to DETAILS_PER_RUN new jobs per run. Job links go to the job's page on the company's career site.
"""

from __future__ import annotations

import asyncio
import html
import json
import os
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 100
MAX_JOBS = int(os.environ.get("ACTIVATE_MAX_JOBS", "30000"))
DETAILS_PER_RUN = int(os.environ.get("ACTIVATE_DETAILS_PER_RUN", "300"))
_DESC = re.compile(r'aria-label="Job description"[^>]*>(.*?)(?:<div class="[^"]*similar|DescriptionMap|</main>)', re.S | re.I)


def _txt(v) -> str:
    s = html.unescape(re.sub(r"<[^>]+>", "", str(v or ""))).strip()
    return "" if s in ("None", "null") else s


def _slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-") or "job"


async def _page(http: Fetcher, host: str, start: int) -> dict:
    r = await http.client.post(f"https://{host}/Search/SearchResults", params={"jtStartIndex": start, "jtPageSize": PAGE}, headers={"X-Requested-With": "XMLHttpRequest"})
    r.raise_for_status()  # a failed page fails the run, so a partial list never closes open jobs
    d = r.json()
    return json.loads(d) if isinstance(d, str) else d


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower()
    first = await _page(http, host, 0)
    records = list(first.get("Records") or [])
    total = min(int(first.get("TotalRecordCount") or 0), MAX_JOBS)
    for start in range(PAGE, total, PAGE):
        records += (await _page(http, host, start)).get("Records") or []

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)
    seen: set[str] = set()

    async def one(d: dict) -> RawJob | None:
        nonlocal budget
        jid, title = _txt(d.get("ID")), _txt(d.get("Title"))
        if not jid or not title or jid in seen:
            return None
        seen.add(jid)
        url = f"https://{host}/search/jobdetails/{_slug(title)}/{jid}"
        city, state, country = _txt(d.get("CityName")), _txt(d.get("StateName")), _txt(d.get("CountryName"))
        try:
            posted = datetime.fromisoformat(_txt(d.get("PostedDateRaw"))).replace(tzinfo=timezone.utc)
        except ValueError:
            posted = None
        raw = RawJob(
            external_id=jid, title=title, job_url=url, apply_url=url,
            location_text=", ".join(x for x in (city, state, country) if x), city_hint=city or None,
            workplace_hint="remote" if _txt(d.get("IsRemote")).lower() == "true" else None,
            posted_at=posted, department=_txt(d.get("DepartmentName")) or _txt(d.get("BrandName")),
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            try:
                async with sem:
                    page = (await http.get(url)).text
                m = _DESC.search(page)
                raw.description = html_to_text(m.group(1))[:20000] if m else ""
            except Exception:
                pass
        return raw

    return [r for r in await asyncio.gather(*(one(d) for d in records)) if r]
