"""Lever Postings API: api.lever.co/v0/postings/{site}?mode=json (EU: api.eu.lever.co)."""

from __future__ import annotations

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time, period_of, workplace_of


async def _fetch(http: Fetcher, company: Company, host: str) -> list[RawJob]:
    data = await http.json(f"https://{host}/v0/postings/{company.token}", params={"mode": "json"})
    jobs = []
    for j in data if isinstance(data, list) else []:
        cat = j.get("categories") or {}
        sal = j.get("salaryRange") or {}
        salary = (
            Salary(sal["min"], sal["max"], sal["currency"], period_of(sal.get("interval")))
            if sal.get("min") and sal.get("max") and sal.get("currency")
            else None
        )
        body = j.get("descriptionPlain") or html_to_text(j.get("description"))
        lists = "\n".join(f"{x.get('text', '')}\n{html_to_text(x.get('content'))}" for x in j.get("lists") or [])
        jobs.append(
            RawJob(
                external_id=j["id"],
                title=j.get("text", "").strip(),
                job_url=j.get("hostedUrl", ""),
                apply_url=j.get("applyUrl") or j.get("hostedUrl", ""),
                location_text=cat.get("location", ""),
                country_hint=(j.get("country") or "").upper() or None,
                workplace_hint=workplace_of(j.get("workplaceType")),
                posted_at=parse_time(j.get("createdAt")),
                description=f"{body}\n\n{lists}".strip(),
                salary=salary,
                department=cat.get("team") or cat.get("department") or "",
                extra_locations=[x for x in cat.get("allLocations") or [] if x != cat.get("location")],
            )
        )
    return jobs


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    return await _fetch(http, company, "api.lever.co")


async def fetch_eu(http: Fetcher, company: Company) -> list[RawJob]:
    return await _fetch(http, company, "api.eu.lever.co")
