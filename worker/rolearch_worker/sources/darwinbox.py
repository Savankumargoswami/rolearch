"""Darwinbox, the most common hiring system among Indian employers: {company}.darwinbox.in/ms/candidate/careers.

Token: the careers host, e.g. "aartiindustries.darwinbox.in" (some tenants are on darwinbox.com). The careers app
loads its list from POST /ms/candidateapi/job/alljobs (public; the site has no robots.txt), which carries the
title, locations, description, experience range, salary when published, and posting date.
"""

from __future__ import annotations

import html
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text

PAGE = 50
MAX_PAGES = 40


def _clean(s: str) -> str:
    return " ".join((s or "").replace("\r", " ").split()).strip(" ,")


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().strip("/")
    api = f"https://{host}/ms/candidateapi/job/alljobs"
    jobs: list[RawJob] = []
    seen: set[str] = set()
    for page in range(1, MAX_PAGES + 1):
        d = await http.post_json(f"{api}?companyId=main", {"page": page, "limit": PAGE})
        rows = (d or {}).get("data") or []
        for j in rows:
            jid = str(j.get("id") or j.get("_id") or "")
            if not jid or jid in seen:
                continue
            seen.add(jid)
            locs = [_clean(x) for x in j.get("officelocation_show_arr_list") or j.get("officelocations_without_area") or [] if _clean(x)]
            salary = None
            try:
                lo, hi = float(j.get("salary_min") or 0), float(j.get("salary_max") or 0)
                if lo and hi and j.get("salary_currency"):
                    salary = Salary(lo, hi, j["salary_currency"], "year" if (j.get("salary_timeframe") or "Annual") == "Annual" else "month")
            except (TypeError, ValueError):
                pass
            posted = j.get("posted_on")
            url = f"https://{host}/ms/candidatev2/main/careers/jobDetails/{jid}"
            jobs.append(
                RawJob(
                    external_id=jid,
                    title=_clean(j.get("title") or j.get("designation_name") or ""),
                    job_url=url,
                    apply_url=url,
                    location_text=locs[0] if locs else _clean(j.get("country") or ""),
                    extra_locations=locs[1:],
                    workplace_hint="remote" if j.get("is_remote") else None,
                    posted_at=datetime.fromtimestamp(int(posted), timezone.utc) if str(posted or "").isdigit() else None,
                    description=html_to_text(html.unescape(j.get("jd") or ""))[:20000] or (j.get("jd_summary") or ""),
                    salary=salary,
                    department=_clean(j.get("department_name_only") or j.get("department_name") or ""),
                )
            )
        if len(rows) < PAGE:
            break
    return jobs
