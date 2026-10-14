"""Greenhouse Job Board API: boards-api.greenhouse.io/v1/boards/{token}/jobs (public, no key)."""

from __future__ import annotations

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time

API = "https://boards-api.greenhouse.io/v1/boards/{token}/jobs"


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    data = await http.json(API.format(token=company.token), params={"content": "true", "pay_transparency": "true"})
    jobs = []
    for j in data.get("jobs", []):
        url = j.get("absolute_url") or f"https://job-boards.greenhouse.io/{company.token}/jobs/{j['id']}"
        salary = None
        for pay in j.get("pay_input_ranges") or []:
            if pay.get("min_cents") and pay.get("max_cents") and pay.get("currency_type"):
                salary = Salary(pay["min_cents"] / 100, pay["max_cents"] / 100, pay["currency_type"], "year")
                break
        offices = [o.get("location") or o.get("name") for o in j.get("offices") or [] if o]
        jobs.append(
            RawJob(
                external_id=str(j["id"]),
                title=j.get("title", "").strip(),
                job_url=url,
                apply_url=url,  # Greenhouse job pages carry the application form
                location_text=(j.get("location") or {}).get("name", ""),
                posted_at=parse_time(j.get("first_published") or j.get("updated_at")),
                description=html_to_text(j.get("content")),
                salary=salary,
                department=", ".join(d.get("name", "") for d in j.get("departments") or []),
                extra_locations=[o for o in offices if o],
            )
        )
    return jobs
