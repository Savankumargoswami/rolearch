"""RippleHire career sites ({company}.ripplehire.com, e.g. HDFC Bank).

Token: the career site's host, e.g. "hdfcbank.ripplehire.com". The site's public careers link redirects to
/candidate/?token=…; that public site token goes with each request. candidatejobsearchpage lists 100 jobs
a page (title, city, experience); candidatejobdetail has the description, read for up to DETAILS_PER_RUN
new jobs per run. Job links open the job on the company's RippleHire career site.
"""

from __future__ import annotations

import asyncio
import json
import os
import re
from datetime import datetime, timezone
from urllib.parse import parse_qs, urlsplit

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 100
MAX_PAGES = 100
DETAILS_PER_RUN = int(os.environ.get("RIPPLEHIRE_DETAILS_PER_RUN", "300"))


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower()
    landing = await http.get(f"https://{host}/candidate/careers")
    site = (parse_qs(urlsplit(str(landing.url)).query).get("token") or [""])[0]
    if not site:
        raise RuntimeError("career site token not found")

    items: list[dict] = []
    for page in range(1, MAX_PAGES + 1):
        params = {"page": page, "search": "*:*", "token": site, "source": "CAREERSITE", "pagesize": PAGE}
        r = await http.client.post(f"https://{host}/candidate/candidatejobsearchpage", data={"careerSiteUrlParams": json.dumps(params), "lang": "en"}, headers={"Accept": "application/json"})
        r.raise_for_status()  # a failed page fails the run, so a partial list never closes open jobs
        batch = r.json() or []
        items += batch
        if len(batch) < PAGE:
            break

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)
    seen: set[str] = set()

    async def one(d: dict) -> RawJob | None:
        nonlocal budget
        jid, title = str(d.get("jobSeq") or d.get("jobId") or ""), (d.get("jobTitle") or "").strip()
        if not jid or not title or jid in seen:
            return None
        seen.add(jid)
        url = f"https://{host}/candidate/?token={site}&source=CAREERSITE#detail/job/{jid}"
        places = [p.strip() for p in str(d.get("locations") or d.get("jobLocation") or "").split(",") if p.strip()]
        raw = RawJob(
            external_id=jid, title=title, job_url=url, apply_url=url,
            location_text=places[0] if places else "", city_hint=places[0] if places else None,  # country: the company's
            extra_locations=places[1:6], department=d.get("jobCode") or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            try:
                async with sem:
                    det = await http.json(f"https://{host}/candidate/candidatejobdetail", params={"token": site, "jobSeq": jid, "source": "CAREERSITE", "lang": "en"})
                vo = (det or {}).get("jobVO") or {}
                raw.description = html_to_text(re.sub(r"(?is)<(style|script)[^>]*>.*?</\1>", " ", vo.get("jobDesc") or ""))[:20000]
                try:
                    raw.posted_at = datetime.strptime(vo.get("jobPostingDate") or "", "%d-%b-%Y").replace(tzinfo=timezone.utc)
                except ValueError:
                    pass
            except Exception:
                pass
        return raw

    return [r for r in await asyncio.gather(*(one(d) for d in items)) if r]
