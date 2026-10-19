"""Oracle Taleo career sections ({company}.taleo.net/careersection/{section}/jobsearch.ftl).

Token format: "company|section|portal", e.g. "valero|2|101430233". The list comes from the section's
own search endpoint (POST /careersection/rest/jobboard/searchjobs, 25 a page); each job's description
is in its job page's data block, read for up to DETAILS_PER_RUN new jobs a run.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
import urllib.parse
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

DETAILS_PER_RUN = int(os.environ.get("TALEO_DETAILS_PER_RUN", "300"))
MAX_PAGES = 200
_LIST = re.compile(r"api\.fillList\('requisitionDescriptionInterface',\s*'descRequisition',\s*\[(.*?)\]\);", re.S)
_STR = re.compile(r"'((?:[^'\\]|\\.)*)'")


def _body(page: int) -> dict:
    return {
        "multilineEnabled": False,
        "sortingSelection": {"sortBySelectionParam": "3", "ascendingSortingOrder": "false"},
        "fieldData": {"fields": {"KEYWORD": "", "LOCATION": ""}, "valid": True},
        "filterSelectionParam": {"searchFilterSelections": []},
        "advancedSearchFiltersSelectionParam": {"searchFilterSelections": []},
        "pageNo": page,
    }


def _date(s: str) -> datetime | None:
    try:
        return datetime.strptime(s.strip(), "%b %d, %Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def place(loc: str) -> tuple[str, str | None, str | None]:
    """Taleo writes places country-first: 'US-TX-San Antonio' or 'Australia-Melbourne'.
    Returns ('San Antonio, TX, US', 'San Antonio', 'US') / ('Melbourne, Australia', 'Melbourne', None)."""
    parts = [p.strip() for p in loc.split("-") if p.strip()]
    if len(parts) < 2:
        return loc, None, None
    code = parts[0] if re.fullmatch(r"[A-Z]{2}", parts[0]) else None
    return ", ".join(reversed(parts)), parts[-1], code


def description(page: str) -> str:
    m = _LIST.search(page)
    if not m:
        return ""
    seen, parts = set(), []
    for v in _STR.findall(m.group(1)):
        if v.startswith("!*!") and v not in seen:
            seen.add(v)
            parts.append(urllib.parse.unquote(v[3:]))
    return html_to_text("\n".join(parts))[:20000]


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host, section, portal = company.token.split("|")
    base = f"https://{host}.taleo.net/careersection"

    async def search(page: int) -> dict:
        r = await http.client.post(
            f"{base}/rest/jobboard/searchjobs",
            params={"lang": "en", "portal": portal},
            json=_body(page),
            headers={"Content-Type": "application/json", "tz": "GMT-05:00"},
        )
        r.raise_for_status()
        return r.json()

    first = await search(1)
    paging = first.get("pagingData") or {}
    size = int(paging.get("pageSize") or 25)
    pages = min(MAX_PAGES, -(-int(paging.get("totalCount") or 0) // size))
    reqs = list(first.get("requisitionList") or [])
    for r in await asyncio.gather(*(search(p) for p in range(2, pages + 1)), return_exceptions=True):
        if isinstance(r, dict):
            reqs.extend(r.get("requisitionList") or [])

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(q: dict) -> RawJob | None:
        nonlocal budget
        cols = q.get("column") or []
        contest = q.get("contestNo") or ""
        if not contest or not cols:
            return None
        loc_idx = (q.get("locationsColumns") or [1])[0]
        try:
            locs = json.loads(cols[loc_idx]) if loc_idx < len(cols) else []
        except (TypeError, ValueError):
            locs = [cols[loc_idx]] if loc_idx < len(cols) else []
        text, city, country = place(locs[0] if locs else "")
        url = f"{base}/{section}/jobdetail.ftl?job={contest}&lang=en"
        raw = RawJob(
            external_id=str(q.get("jobId") or contest),
            title=str(cols[q.get("linkedColumn") or 0]).strip(),
            job_url=url,
            apply_url=url,
            location_text=text,
            city_hint=city,
            country_hint=country,
            posted_at=_date(cols[-1]) if cols else None,
            extra_locations=[place(x)[0] for x in locs[1:5]],
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget > 0:
            budget -= 1
            try:
                async with sem:
                    page = await http.get(url, attempts=2)
                raw.description = description(page.text)
            except Exception:
                pass
        return raw

    return [r for r in await asyncio.gather(*(one(q) for q in reqs)) if r]
