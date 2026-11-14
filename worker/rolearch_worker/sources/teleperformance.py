"""Teleperformance (TP), read through tp.com's careers API.

Token: the careers page node, e.g. "1780" (www.tp.com/en-us/careers/job-opportunities). TP hires through a
different system in each country (iCIMS in the US, softgarden in Germany, ...); /Umbraco/Api/Careers/
GetCareersBase lists all of them, 200 a page, with the description and each job's link on its own system.
"""

from __future__ import annotations

import asyncio
import re
from datetime import datetime, timezone

from ..geo import country_code
from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

API = "https://www.tp.com/Umbraco/Api/Careers/GetCareersBase"
PAGE = 200
MAX_PAGES = 100


def _place(loc: str, country: str) -> str:
    m = re.fullmatch(r"([A-Z]{2})-(.+)", loc.strip())  # US sites write "MI-Warren"
    loc = f"{m.group(2)}, {m.group(1)}" if m else loc.strip(" -,")  # Malaysia's read "-Petaling Jaya"
    return ", ".join(x for x in (loc, country) if x)


def _raw(d: dict) -> RawJob | None:
    title, url = (d.get("title") or "").strip(), (d.get("url") or "").strip()
    if not title or not url.startswith("http"):
        return None
    try:
        posted = datetime.fromisoformat(d["date"]).replace(tzinfo=timezone.utc) if d.get("date") else None
    except ValueError:
        posted = None
    country = (d.get("country") or "").strip()
    return RawJob(
        external_id=f"{d.get('source') or ''}:{d.get('externalId') or url}",
        title=title,
        job_url=url,
        apply_url=url,
        location_text=_place(d.get("location") or "", country),
        country_hint=country_code(country) if country else None,
        workplace_hint="remote" if str(d.get("workFromHome") or "").lower() == "yes" else None,
        posted_at=posted,
        description=html_to_text(d.get("description") or "")[:20000],
        department=d.get("category") or "",
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    node = company.token.strip()

    def params(page: int) -> dict:
        return {"node": node, "country": "", "culture": "en-us", "pageSize": PAGE, "page": page}

    first = await http.json(API, params=params(0))
    total = int(first.get("totalRegistros") or 0)
    # No return_exceptions: a failed page fails the run, so a partial list never closes open jobs.
    pages = [first] + list(await asyncio.gather(*(http.json(API, params=params(n)) for n in range(1, min((total + PAGE - 1) // PAGE, MAX_PAGES)))))
    jobs: dict[str, RawJob] = {}
    for page in pages:
        for item in page.get("resultado") or []:
            raw = _raw(item)
            if raw:
                jobs.setdefault(raw.external_id, raw)
    return list(jobs.values())
