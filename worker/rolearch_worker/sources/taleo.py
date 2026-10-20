"""Oracle Taleo career sections ({company}.taleo.net/careersection/{section}/jobsearch.ftl).

Token format: "company|section|portal", e.g. "valero|2|101430233". The list comes from the section's
own search endpoint (POST /careersection/rest/jobboard/searchjobs, 25 a page); each job's description
is in its job page's data block, read for up to DETAILS_PER_RUN new jobs a run.

Older (non-faceted) career sections have no portal number: token "company|section", e.g. "lbrands|bbw_in".
Their job list is the first page's requisition list plus the pager's AJAX pages (25 a page).
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


_REQ_LIST = re.compile(r"api\.fillList\('requisitionListInterface',\s*'listRequisition',\s*\[(.*?)\]\);", re.S)
_POSTED = re.compile(r"^[A-Z][a-z]{2} \d{1,2}, \d{4}$")


def legacy_rows(vals: list[str]) -> list[tuple[str, str, str, str, str]]:
    """(job id, title, job number, place, posted) from a classic requisition list's flat value list.
    A row starts with id, title, id, title; the job number and place follow the repeated ids."""
    out, i = [], 0
    while i < len(vals) - 4:
        jid, title = vals[i], vals[i + 1]
        if jid.isdigit() and title and vals[i + 2] == jid and vals[i + 3] == title:
            k = i + 4
            while k < len(vals) and vals[k] == jid:
                k += 1
            number = vals[k] if k < len(vals) else jid
            loc = vals[k + 1] if k + 1 < len(vals) else ""
            posted = next((v for v in vals[k + 2:k + 16] if _POSTED.match(v)), "")
            out.append((jid, urllib.parse.unquote(title), number, urllib.parse.unquote(loc), posted))
            i = k + 2
        else:
            i += 1
    return out


async def _legacy(http: Fetcher, company: Company, host: str, section: str) -> list[RawJob]:
    base = f"https://{host}.taleo.net/careersection/{section}"
    first = await http.get(f"{base}/jobsearch.ftl", params={"lang": "en"})
    m = _REQ_LIST.search(first.text)
    rows = legacy_rows(_STR.findall(m.group(1))) if m else []
    total_m = re.search(r"listRequisition\.nbElements!\|!(\d+)", first.text)
    size_m = re.search(r"listRequisition\.pageSize!\|!(\d+)", first.text) or re.search(r"!\|!(\d+)!\|!listRequisition\.nbElements", first.text)
    total = int(total_m.group(1)) if total_m else len(rows)
    size = max(len(rows), 1)
    pages = min(MAX_PAGES, -(-total // size))
    for page in range(2, pages + 1):
        data = {"ftlpageid": "reqListBasicPage", "ftlinterfaceid": "requisitionListInterface", "ftlcompid": "rlPager", "jsfCmdId": "rlPager",
                "ftlcompclass": "PagerComponent", "ftlcallback": "ftlPager_processResponse", "ftlajaxid": "ftlx1", "rlPager.currentPage": str(page), "lang": "en"}
        try:
            r = await http.post_form(f"{base}/jobsearch.ajax", data)
        except Exception:
            break
        got = legacy_rows(r.text.split("!|!"))
        if not got:
            break
        rows += got

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)
    seen: set[str] = set()

    async def one(jid: str, title: str, number: str, loc: str, posted: str) -> RawJob:
        nonlocal budget
        text, city, country = place(loc)
        url = f"{base}/jobdetail.ftl?job={urllib.parse.quote(number)}&lang=en"
        raw = RawJob(external_id=jid, title=title.strip(), job_url=url, apply_url=url, location_text=text,
                     city_hint=city, country_hint=country, posted_at=_date(posted) if posted else None)
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            try:
                async with sem:
                    page = await http.get(url, attempts=2)
                raw.description = description(page.text)
            except Exception:
                pass
        return raw

    unique = [r for r in rows if not (r[0] in seen or seen.add(r[0]))]
    return list(await asyncio.gather(*(one(*r) for r in unique)))


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    parts = company.token.split("|")
    if len(parts) == 2:
        return await _legacy(http, company, *parts)
    host, section, portal = parts
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
