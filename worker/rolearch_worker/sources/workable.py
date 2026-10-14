"""Workable public widget API: apply.workable.com/api/v1/widget/accounts/{subdomain}?details=true."""

from __future__ import annotations

from ..geo import country_code
from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    data = await http.json(
        f"https://apply.workable.com/api/v1/widget/accounts/{company.token}", params={"details": "true"}
    )
    jobs = []
    for j in data.get("jobs", []):
        loc = ", ".join(x for x in (j.get("city"), j.get("state"), j.get("country")) if x)
        jobs.append(
            RawJob(
                external_id=j.get("shortcode") or j.get("code") or j["url"],
                title=(j.get("title") or "").strip(),
                job_url=j.get("url") or j.get("shortlink", ""),
                apply_url=j.get("application_url") or j.get("url", ""),
                location_text=loc,
                country_hint=country_code(j.get("country") or ""),
                city_hint=j.get("city"),
                workplace_hint="remote" if j.get("telecommuting") else None,
                posted_at=parse_time(j.get("published_on") or j.get("created_at")),
                description=html_to_text(j.get("description")),
                department=j.get("department") or "",
            )
        )
    return jobs
