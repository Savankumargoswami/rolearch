"""Apple jobs (jobs.apple.com): the search pages' server-rendered data.

Token: unused ("all"). Each search page embeds 20 results (title, team, places, posting date and a job
summary) in its hydration data; we read every page a few at a time. Links go to the job on jobs.apple.com.
"""

from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime

from ..http import Fetcher
from ..models import Company, RawJob

SEARCH = "https://jobs.apple.com/en-us/search"
MAX_PAGES = 600
_DATA = re.compile(r"window\.__staticRouterHydrationData\s*=\s*JSON\.parse\((\".*?\")\);", re.S)
_COUNTRY = {"USA": "US", "GBR": "GB", "CHN": "CN", "IND": "IN", "DEU": "DE", "FRA": "FR", "JPN": "JP", "CAN": "CA", "AUS": "AU", "IRL": "IE", "ESP": "ES", "ITA": "IT", "SGP": "SG", "KOR": "KR", "TWN": "TW", "NLD": "NL", "ISR": "IL", "MEX": "MX", "BRA": "BR", "CHE": "CH", "SWE": "SE", "DNK": "DK", "AUT": "AT", "BEL": "BE", "POL": "PL", "CZE": "CZ", "MYS": "MY", "THA": "TH", "VNM": "VN", "IDN": "ID", "PHL": "PH", "HKG": "HK", "ARE": "AE", "SAU": "SA", "TUR": "TR", "NZL": "NZ", "PRT": "PT", "FIN": "FI", "NOR": "NO"}


def _search(page: str) -> dict:
    m = _DATA.search(page)
    if not m:
        return {}
    data = json.loads(json.loads(m.group(1)))
    return ((data.get("loaderData") or {}).get("search")) or {}


def _raw(r: dict) -> RawJob | None:
    pid, title = r.get("positionId"), (r.get("postingTitle") or "").strip()
    if not pid or not title:
        return None
    url = f"https://jobs.apple.com/en-us/details/{pid}/{r.get('transformedPostingTitle') or 'job'}"
    locs = r.get("locations") or []
    first = locs[0] if locs else {}
    iso3 = (first.get("countryID") or "").replace("iso-country-", "")
    city = first.get("city") or ""
    place = ", ".join(x for x in (city, first.get("stateProvince"), first.get("countryName")) if x) or first.get("name", "")
    posted = None
    if r.get("postDateInGMT"):
        try:
            posted = datetime.fromisoformat(r["postDateInGMT"][:19] + "+00:00")
        except ValueError:
            posted = None
    return RawJob(
        external_id=str(pid),
        title=title,
        job_url=url,
        apply_url=url,
        location_text=place,
        city_hint=city or None,
        country_hint=_COUNTRY.get(iso3),
        workplace_hint="remote" if r.get("homeOffice") else None,
        posted_at=posted,
        description=(r.get("jobSummary") or "").strip()[:20000],
        department=(r.get("team") or {}).get("teamName") or "",
        extra_locations=[x.get("name", "") for x in locs[1:6]],
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    first = _search((await http.get(SEARCH, params={"page": 1})).text)
    per = len(first.get("searchResults") or []) or 20
    pages = min(MAX_PAGES, -(-int(first.get("totalRecords") or 0) // per))
    sem = asyncio.Semaphore(3)

    async def page(n: int) -> dict:
        async with sem:
            return _search((await http.get(SEARCH, params={"page": n})).text)

    results = list(first.get("searchResults") or [])
    for p in await asyncio.gather(*(page(n) for n in range(2, pages + 1)), return_exceptions=True):
        if isinstance(p, dict):
            results.extend(p.get("searchResults") or [])
    jobs: dict[str, RawJob] = {}
    for r in results:
        raw = _raw(r)
        if raw:
            jobs.setdefault(raw.external_id, raw)
    return list(jobs.values())
