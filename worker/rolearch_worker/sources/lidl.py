"""Lidl's own career sites (careers.lidl.co.uk and the other country sites on the same platform).

Token: the career site's host, e.g. "careers.lidl.co.uk". /api/v1/search returns 100 jobs a page with the
full description and the store's address. Job links go to the job's page on the career site; "Apply"
goes to the application form the site itself links.
"""

from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime
from urllib.parse import urlsplit

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 100
MAX_PAGES = 300  # Lidl Germany alone lists ~15,500 jobs
_ISO = {"UK": "GB"}
# Every Lidl/Kaufland country site sits behind the same Akamai edge, which blocks bursts ("Access Denied").
# One request at a time across all of them, with a pause between pages.
_ONE = asyncio.Semaphore(1)
PAUSE = float(os.environ.get("LIDL_PAUSE", "1.0"))


def _date(s: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(s) if s else None
    except ValueError:
        return None


def _raw(host: str, d: dict) -> RawJob | None:
    title = (d.get("title") or "").strip()
    jid = str(d.get("requisitionId") or d.get("postingId") or "")
    url = d.get("jobDetailUrl") or ""
    # Job pages can sit on a sibling host (karriere.lidl.ch lists jobs.lidl.ch pages): same site domain is enough.
    if not title or not jid or not url.startswith("https://") or not urlsplit(url).netloc.endswith(host.split(".", 1)[1]):
        return None
    loc = d.get("location") or {}
    country = (loc.get("country") or d.get("client") or "").upper()
    country = _ISO.get(country, country) if len(_ISO.get(country, country)) == 2 else None
    desc = "\n".join(str(d.get(k) or "") for k in ("descHeader", "descResponsibilities") if d.get(k) and d.get(k) != "None")
    return RawJob(
        external_id=jid,
        title=title,
        job_url=url,
        apply_url=d.get("recruitingUrl") or url,
        location_text=", ".join(x for x in (loc.get("city"), loc.get("state"), loc.get("zipCode")) if x),
        city_hint=loc.get("city") or None,
        country_hint=country,
        posted_at=_date(d.get("onlineFrom") or d.get("modifiedTime")),
        description=html_to_text(desc)[:20000],
        department=d.get("employmentArea") or "",
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower()
    api = f"https://{host}/api/v1/search"

    def params(page: int) -> dict:
        return {"general": json.dumps({"page": page, "resultsPerPage": PAGE, "sortField": "", "sortOrder": "asc"})}

    async def page(n: int) -> dict:
        async with _ONE:
            try:
                return await http.json(api, params=params(n))
            finally:
                await asyncio.sleep(PAUSE)

    first = await page(1)
    total = int((first.get("meta") or {}).get("totalCount") or 0)
    pages = [first]
    for n in range(2, min((total + PAGE - 1) // PAGE, MAX_PAGES) + 1):
        pages.append(await page(n))  # a failed page fails the run, so a partial list never closes open jobs
    jobs: dict[str, RawJob] = {}
    for page in pages:
        for item in page.get("jobs") or []:
            raw = _raw(host, item)
            if raw:
                jobs.setdefault(raw.external_id, raw)
    return list(jobs.values())
