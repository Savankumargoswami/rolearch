"""Oracle Recruiting Cloud career sites ({host}.fa.{dc}.oraclecloud.com/hcmUI/CandidateExperience/.../sites/{site}).

Reads the public REST resources the career site itself calls. Token format: "host|dc|site", e.g.
"efet|us2|CX_1". Like Workday, the list is cheap and each description is one more request, so a run
fills at most DETAILS_PER_RUN descriptions per company and later runs fill in the rest.
"""

from __future__ import annotations

import asyncio
import os
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 50
MAX_JOBS = int(os.environ.get("ORACLE_MAX_JOBS", "100000"))
DETAILS_PER_RUN = int(os.environ.get("ORACLE_DETAILS_PER_RUN", "300"))
_ORACLE = asyncio.Semaphore(int(os.environ.get("ORACLE_CONCURRENCY", "6")))


def _date(s: str | None) -> datetime | None:
    if not s:
        return None
    try:
        return datetime.fromisoformat(s[:10]).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host, dc, site = company.token.split("|")
    # Most tenants are {host}.fa.{dc}.oraclecloud.com; some (e.g. jpmc.fa.oraclecloud.com) have no data-centre part.
    # Custom career domains (e.g. "enterpriseplatform.dell.com") serve the same API at their own address.
    origin = f"https://{host}" if "." in host else f"https://{host}.fa.{dc}.oraclecloud.com" if dc else f"https://{host}.fa.oraclecloud.com"
    api = f"{origin}/hcmRestApi/resources/latest"

    listed: list[dict] = []
    offset = 0
    while offset < MAX_JOBS:
        async with _ORACLE:
            data = await http.json(
                f"{api}/recruitingCEJobRequisitions",
                params={"onlyData": "true", "expand": "requisitionList.secondaryLocations", "finder": f"findReqs;siteNumber={site},limit={PAGE},offset={offset},sortBy=POSTING_DATES_DESC"},
            )
        item = (data.get("items") or [{}])[0]
        reqs = item.get("requisitionList") or []
        listed.extend(r for r in reqs if r.get("Id") and r.get("Title"))
        offset += PAGE
        if len(reqs) < PAGE or offset >= int(item.get("TotalJobsCount") or 0):
            break

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN

    async def one(r: dict) -> RawJob:
        nonlocal budget
        url = f"{origin}/hcmUI/CandidateExperience/en/sites/{site}/job/{r['Id']}"
        workplace = (r.get("WorkplaceTypeCode") or "").upper()
        raw = RawJob(
            external_id=str(r["Id"]),
            title=r["Title"].strip(),
            job_url=url,
            apply_url=url,
            location_text=r.get("PrimaryLocation") or "",
            country_hint=(r.get("PrimaryLocationCountry") or "").upper() or None,
            workplace_hint="remote" if "REMOTE" in workplace else "hybrid" if "HYBRID" in workplace else None,
            posted_at=_date(r.get("PostedDate")),
            description=r.get("ShortDescriptionStr") or "",
            extra_locations=[x.get("Name", "") for x in (r.get("secondaryLocations") or [])][:5],
        )
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget <= 0:
            raw.description = ""  # filled in by a later run
            return raw
        budget -= 1
        try:
            async with _ORACLE:
                d = await http.json(
                    f"{api}/recruitingCEJobRequisitionDetails",
                    params={"onlyData": "true", "expand": "all", "finder": f'ById;Id="{r["Id"]}",siteNumber={site}'},
                )
            info = (d.get("items") or [{}])[0]
            parts = [info.get("ExternalDescriptionStr"), info.get("ExternalResponsibilitiesStr"), info.get("ExternalQualificationsStr")]
            text = "\n\n".join(html_to_text(p) for p in parts if p)
            if text:
                raw.description = text[:20000]
        except Exception:
            pass
        return raw

    return list(await asyncio.gather(*(one(r) for r in listed)))
