"""Find and verify job boards for a list of companies by web domain.

For each company we load its likely careers pages (careers.{domain}, jobs.{domain}, {domain}/careers),
detect the job system with identify.py (plus Phenom and Jibe, which identify from the page itself),
and keep a board only if its public job feed answers with at least one job.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from .http import Fetcher
from .identify import match

PREFERRED = ["workday", "oracle", "eightfold", "greenhouse", "lever", "ashby", "smartrecruiters", "successfactors-host", "jibe", "phenom"]


@dataclass
class Board:
    ats: str
    token: str
    jobs: int


async def _count(http: Fetcher, ats: str, token: str) -> int:
    """How many jobs a board's public feed reports (0 if it doesn't answer)."""
    try:
        if ats == "workday":
            t, wd, site = token.split("|")
            d = await http.post_json(f"https://{t}.{wd}.myworkdayjobs.com/wday/cxs/{t}/{site}/jobs", {"appliedFacets": {}, "limit": 1, "offset": 0, "searchText": ""})
            return int(d.get("total") or 0)
        if ats == "oracle":
            host, dc, site = token.split("|")
            origin = f"https://{host}" if "." in host else f"https://{host}.fa.{dc}.oraclecloud.com" if dc else f"https://{host}.fa.oraclecloud.com"
            d = await http.json(f"{origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitions", params={"onlyData": "true", "expand": "requisitionList", "finder": f"findReqs;siteNumber={site},limit=1"})
            return int(((d.get("items") or [{}])[0]).get("TotalJobsCount") or 0)
        if ats == "greenhouse":
            d = await http.json(f"https://boards-api.greenhouse.io/v1/boards/{token}/jobs")
            return len(d.get("jobs") or [])
        if ats == "lever":
            d = await http.json(f"https://api.lever.co/v0/postings/{token}", params={"mode": "json"})
            return len(d) if isinstance(d, list) else 0
        if ats == "ashby":
            d = await http.json(f"https://api.ashbyhq.com/posting-api/job-board/{token}")
            return len(d.get("jobs") or [])
        if ats == "smartrecruiters":
            d = await http.json(f"https://api.smartrecruiters.com/v1/companies/{token}/postings", params={"limit": 1})
            return int(d.get("totalFound") or 0)
        if ats == "eightfold":
            host, domain = token.split("|")
            r = await http.get(f"https://{host}/api/pcsx/search", params={"domain": domain, "start": 0})
            if r.status_code == 200 and isinstance(r.json().get("data"), dict):
                return int(r.json()["data"].get("count") or 0)
            d = await http.json(f"https://{host}/api/apply/v2/jobs", params={"domain": domain, "start": 0, "num": 10})
            return int(d.get("count") or 0)
        if ats == "jibe":
            d = await http.json(f"https://{token}/api/jobs", params={"page": 1, "limit": 1})
            return int(d.get("totalCount") or 0)
        if ats == "phenom":
            host, ref, locale = token.split("|")
            body = {"lang": locale, "deviceType": "desktop", "country": locale.split("_")[-1], "pageName": "search-results", "ddoKey": "refineSearch",
                    "from": 0, "jobs": True, "counts": False, "all_fields": [], "size": 1, "siteType": "external", "keywords": "", "global": True,
                    "selected_fields": {}, "refNum": ref}
            d = await http.post_json(f"https://{host}/widgets", body)
            return int((d.get("refineSearch") or {}).get("totalHits") or 0)
        if ats == "workable":
            d = await http.json(f"https://apply.workable.com/api/v1/widget/accounts/{token}")
            return len(d.get("jobs") or [])
        if ats == "breezy":
            from .sources.breezy import positions

            return len(await positions(http, token))
        if ats == "successfactors-host":
            r = await http.get(f"https://{token}/search/", params={"q": "", "startrow": 0})
            m = re.search(r"of\s*<b>\s*([\d,]+)\s*</b>", r.text)
            return int(m.group(1).replace(",", "")) if m else 0
    except Exception:
        return 0
    return 0


async def discover_domain(http: Fetcher, domain: str) -> Board | None:
    pages = [f"https://careers.{domain}", f"https://jobs.{domain}", f"https://www.{domain}/careers", f"https://www.{domain}/en/careers"]
    candidates: list[tuple[str, str]] = []
    for url in pages:
        try:
            r = await http.get(url, attempts=1)
        except Exception:
            continue
        if r.status_code >= 400:
            continue
        final = urlsplit(str(r.url)).netloc
        html = r.text
        for f in match(str(r.url) + " " + html):
            if f.ats in ("workday", "oracle", "greenhouse", "lever", "ashby", "smartrecruiters"):
                candidates.append((f.ats, f.token))
            elif f.ats == "eightfold":
                candidates.append(("eightfold", f"{f.token}.eightfold.ai|{domain}"))
        ref = re.search(r'"refNum"\s*:\s*"([^"]+)"', html)
        if ref:
            loc = re.search(r'"locale"\s*:\s*"([^"]+)"', html)
            candidates.append(("phenom", f"{final}|{ref.group(1)}|{loc.group(1) if loc else 'en_us'}"))
        if "/job/" in html and "jobTitle-link" in html:
            candidates.append(("successfactors-host", final))
        candidates.append(("jibe", final))
        if "/hcmUI/CandidateExperience" in html and "oraclecloud" not in html:
            site = re.search(r"/sites/([A-Za-z0-9_]+)", html)
            if site:
                candidates.append(("oracle", f"{final}||{site.group(1)}"))
    seen: set[tuple[str, str]] = set()
    ordered = sorted(dict.fromkeys(candidates), key=lambda c: PREFERRED.index(c[0]) if c[0] in PREFERRED else 99)
    for ats, token in ordered:
        if (ats, token) in seen:
            continue
        seen.add((ats, token))
        n = await _count(http, ats, token)
        if n > 0:
            return Board("successfactors" if ats == "successfactors-host" else ats, token, n)
    return None


async def discover_all(rows: list[tuple[str, str, str]], concurrency: int = 10) -> list[tuple[str, str, Board | None]]:
    sem = asyncio.Semaphore(concurrency)
    async with Fetcher() as http:

        async def one(row):
            name, country, domain = row
            async with sem:
                try:
                    board = await asyncio.wait_for(discover_domain(http, domain), timeout=120)
                except Exception:
                    board = None
            return name, country, board

        return await asyncio.gather(*(one(r) for r in rows))
