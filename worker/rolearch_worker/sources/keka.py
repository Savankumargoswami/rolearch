"""Keka, a common hiring system among Indian companies: {company}.keka.com/careers.

Token: the careers host, e.g. "adda247.keka.com". Keka's robots.txt allows only /careers, and that's all this
reads: the careers page names the portal's id, and /careers/api/embedjobs/default/active/{id} (the list the page
itself loads) carries each job's title, description, locations, salary range and publish date.
"""

from __future__ import annotations

import re

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time

_ID = re.compile(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}")
# Keka's salaryPeriod: 0 yearly, 1 monthly, 2 hourly.
_PERIOD = {0: "year", 1: "month", 2: "hour"}


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().strip("/")
    page = await http.get(f"https://{host}/careers")
    portal = _ID.search(page.text)
    if page.status_code != 200 or not portal:
        return []
    data = await http.json(f"https://{host}/careers/api/embedjobs/default/active/{portal.group(0)}")
    jobs = []
    for j in data if isinstance(data, list) else []:
        locs = [", ".join(x for x in (l.get("name"), l.get("countryName")) if x) for l in j.get("jobLocations") or []]
        first = (j.get("jobLocations") or [{}])[0]
        pay = j.get("salaryRange") or {}
        salary = None
        if pay.get("minimum") and pay.get("maximum") and pay.get("currency"):
            salary = Salary(float(pay["minimum"]), float(pay["maximum"]), pay["currency"], _PERIOD.get(pay.get("salaryPeriod"), "year"))
        url = f"https://{host}/careers/jobdetails/{j['id']}"
        jobs.append(
            RawJob(
                external_id=str(j["id"]),
                title=(j.get("title") or "").strip(),
                job_url=url,
                apply_url=url,
                location_text=locs[0] if locs else "",
                extra_locations=locs[1:],
                country_hint=first.get("countryCode"),
                city_hint=first.get("name"),
                posted_at=parse_time(j.get("publishedOn")),
                description=html_to_text(j.get("description"))[:20000],
                salary=salary,
                department=j.get("departmentName") or "",
            )
        )
    return jobs
