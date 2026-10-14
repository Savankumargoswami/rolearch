"""Ashby Job Postings API: api.ashbyhq.com/posting-api/job-board/{name}?includeCompensation=true."""

from __future__ import annotations

from ..geo import country_code
from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time, period_of, workplace_of


def _salary(comp: dict | None) -> Salary | None:
    for c in (comp or {}).get("summaryComponents") or []:
        if c.get("compensationType") == "Salary" and c.get("minValue") and c.get("maxValue") and c.get("currencyCode"):
            return Salary(c["minValue"], c["maxValue"], c["currencyCode"], period_of(c.get("interval")))
    return None


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    data = await http.json(
        f"https://api.ashbyhq.com/posting-api/job-board/{company.token}", params={"includeCompensation": "true"}
    )
    jobs = []
    for j in data.get("jobs", []):
        if j.get("isListed") is False:
            continue
        addr = ((j.get("address") or {}).get("postalAddress")) or {}
        workplace = workplace_of(j.get("workplaceType")) or ("remote" if j.get("isRemote") else None)
        jobs.append(
            RawJob(
                external_id=j["id"],
                title=(j.get("title") or "").strip(),
                job_url=j.get("jobUrl", ""),
                apply_url=j.get("applyUrl") or j.get("jobUrl", ""),
                location_text=j.get("location", ""),
                country_hint=country_code(addr.get("addressCountry", "")) if addr.get("addressCountry") else None,
                city_hint=addr.get("addressLocality"),
                workplace_hint=workplace,
                posted_at=parse_time(j.get("publishedAt")),
                description=j.get("descriptionPlain") or html_to_text(j.get("descriptionHtml")),
                salary=_salary(j.get("compensation")),
                department=j.get("department") or "",
                extra_locations=[s.get("location", "") for s in j.get("secondaryLocations") or []],
            )
        )
    return jobs
