"""ADP Workforce Now career centers, common among mid-size US employers and local governments.

Token: "{cid}|{ccId}" from the career center link (workforcenow.adp.com/.../recruitment.html?cid=...&ccId=...),
ccId usually "19000101_000001". The career center loads its jobs from the public staffing API
(careercenter/public/events/staffing/v1/job-requisitions): title, location, posting date and pay range; each job's
own request adds the description, fetched at most DETAILS_PER_RUN new ones per company per run.
"""

from __future__ import annotations

import asyncio
import os

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time

API = "https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions"
PAGE = 50
MAX_JOBS = 5000
DETAILS_PER_RUN = int(os.environ.get("ADP_DETAILS_PER_RUN", "200"))


def _salary(j: dict) -> Salary | None:
    rng = j.get("payGradeRange") or {}
    lo = ((rng.get("minimumRate") or {}).get("amountValue")) or 0
    hi = ((rng.get("maximumRate") or {}).get("amountValue")) or 0
    cur = ((rng.get("maximumRate") or {}).get("currencyCode")) or "USD"
    if not hi:
        return None
    hourly = any((f.get("nameCode") or {}).get("codeValue") == "SalaryType" and f.get("codeValue") == "HR"
                 for f in ((j.get("customFieldGroup") or {}).get("codeFields") or []))
    return Salary(float(lo or hi), float(hi), cur, "hour" if hourly else "year")


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    from ..normalize import job_id

    cid, _, cc = company.token.partition("|")
    params = {"cid": cid, "ccId": cc or "19000101_000001", "lang": "en_US", "locale": "en_US"}
    rows: list[dict] = []
    skip = 0
    while skip < MAX_JOBS:
        d = await http.json(API, params={**params, "$top": PAGE, "$skip": skip})
        batch = d.get("jobRequisitions") or []
        rows.extend(batch)
        skip += len(batch)
        if not batch or skip >= int((d.get("meta") or {}).get("totalNumber") or 0):
            break

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(j: dict) -> RawJob:
        nonlocal budget
        locs = j.get("requisitionLocations") or []
        names = [((l.get("nameCode") or {}).get("shortName") or "").strip().rstrip(",") for l in locs]
        addr = (locs[0].get("address") or {}) if locs else {}
        url = (f"https://workforcenow.adp.com/mascsr/default/mdf/recruitment/recruitment.html?cid={params['cid']}"
               f"&ccId={params['ccId']}&jobId={j['itemID']}&lang=en_US&source=CC2")
        raw = RawJob(
            external_id=str(j["itemID"]),
            title=(j.get("requisitionTitle") or "").strip(),
            job_url=url,
            apply_url=url,
            location_text=names[0] if names else "",
            extra_locations=[n for n in names[1:] if n],
            city_hint=addr.get("cityName"),
            posted_at=parse_time(j.get("postDate")),
            salary=_salary(j),
            department=((j.get("workLevelCode") or {}).get("shortName")) or "",
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
        elif budget > 0:
            budget -= 1
            async with sem:
                try:
                    d = await http.json(f"{API}/{j['itemID']}", params=params)
                    raw.description = html_to_text(d.get("requisitionDescription"))[:20000]
                except Exception:
                    pass
        return raw

    return list(await asyncio.gather(*(one(j) for j in rows if j.get("itemID") and j.get("requisitionTitle"))))
