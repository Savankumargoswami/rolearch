"""Gem job boards: api.gem.com/job_board/v0/{slug}/job_posts/ (public, Greenhouse-style, with descriptions)."""

from __future__ import annotations

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time, workplace_of


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    data = await http.json(f"https://api.gem.com/job_board/v0/{company.token}/job_posts/")
    jobs = []
    for j in data if isinstance(data, list) else []:
        url = j.get("absolute_url") or ""
        if not url:
            continue
        offices = [o.get("name") for o in j.get("offices") or [] if o and o.get("name")]
        jobs.append(
            RawJob(
                external_id=str(j.get("id") or url),
                title=(j.get("title") or "").strip(),
                job_url=url,
                apply_url=url,
                location_text=(j.get("location") or {}).get("name", ""),
                workplace_hint=workplace_of(j.get("location_type")),
                posted_at=parse_time(j.get("first_published_at") or j.get("updated_at")),
                description=(j.get("content_plain") or html_to_text(j.get("content")))[:20000],
                department=", ".join(d.get("name", "") for d in j.get("departments") or []),
                extra_locations=offices,
            )
        )
    return jobs
