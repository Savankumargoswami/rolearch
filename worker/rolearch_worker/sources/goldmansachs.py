"""Goldman Sachs (higher.gs.com), read through the site's own GraphQL role search.

Token: "higher.gs.com". GetRoles returns 100 roles a page with title, division and places; each role's
description comes from the role page's Next.js data (/_next/data/{build}/roles/{id}.json), read for up
to DETAILS_PER_RUN new roles per run. Job links go to the role's page on higher.gs.com.
"""

from __future__ import annotations

import asyncio
import json
import os
import re

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

API = "https://api-higher.gs.com/gateway/api/v1/graphql"
PAGE = 100
MAX_PAGES = 50
DETAILS_PER_RUN = int(os.environ.get("GOLDMAN_DETAILS_PER_RUN", "300"))
_QUERY = (
    "query GetRoles($searchQueryInput: RoleSearchQueryInput!) { roleSearch(searchQueryInput: $searchQueryInput) "
    "{ totalCount items { roleId jobTitle jobFunction division locations { primary state country city } externalSource { sourceId } } } }"
)
_HEADERS = {"Origin": "https://higher.gs.com", "Referer": "https://higher.gs.com/"}


async def _page(http: Fetcher, n: int) -> dict:
    body = {
        "operationName": "GetRoles",
        "query": _QUERY,
        "variables": {"searchQueryInput": {
            "page": {"pageSize": PAGE, "pageNumber": n}, "sort": {"sortStrategy": "RELEVANCE", "sortOrder": "DESC"},
            "filters": [], "experiences": ["EARLY_CAREER", "PROFESSIONAL"], "searchTerm": "",
        }},
    }
    r = await http.client.post(API, json=body, headers=_HEADERS)
    r.raise_for_status()  # a failed page fails the run, so a partial list never closes open jobs
    return r.json()["data"]["roleSearch"]


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower() or "higher.gs.com"
    first = await _page(http, 0)
    items = list(first.get("items") or [])
    total = int(first.get("totalCount") or 0)
    for n in range(1, min((total + PAGE - 1) // PAGE, MAX_PAGES)):
        items += (await _page(http, n)).get("items") or []

    build = None
    try:
        page = (await http.get(f"https://{host}/results")).text
        build = json.loads(re.search(r'<script id="__NEXT_DATA__"[^>]*>(.*?)</script>', page, re.S).group(1))["buildId"]
    except Exception:
        pass  # no descriptions this run; the roles still list

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)
    seen: set[str] = set()

    async def one(d: dict) -> RawJob | None:
        nonlocal budget
        rid, title = str(d.get("roleId") or ""), (d.get("jobTitle") or "").strip()
        page_id = str((d.get("externalSource") or {}).get("sourceId") or rid.split("_")[0])
        if not rid or not title or rid in seen:
            return None
        seen.add(rid)
        locs = sorted(d.get("locations") or [], key=lambda x: not x.get("primary"))
        places = [", ".join(x for x in (l.get("city"), l.get("state"), l.get("country")) if x) for l in locs]
        url = f"https://{host}/roles/{page_id}"
        raw = RawJob(
            external_id=rid, title=title, job_url=url, apply_url=url,
            location_text=places[0] if places else "", city_hint=(locs[0].get("city") if locs else None),
            extra_locations=places[1:6], department=d.get("division") or d.get("jobFunction") or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif build and budget > 0:
            budget -= 1
            try:
                async with sem:
                    det = await http.json(f"https://{host}/_next/data/{build}/roles/{page_id}.json", params={"roleId": page_id})
                raw.description = html_to_text(((det.get("pageProps") or {}).get("role") or {}).get("descriptionHtml") or "")[:20000]
            except Exception:
                pass
        return raw

    return [r for r in await asyncio.gather(*(one(d) for d in items)) if r]
