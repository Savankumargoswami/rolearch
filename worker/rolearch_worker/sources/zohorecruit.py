"""Zoho Recruit career sites: {company}.zohorecruit.com/jobs/Careers (or .in / .eu).

Token: the careers host, e.g. "elephantdesign.zohorecruit.com". Zoho's robots.txt allows the career portal. The
careers page embeds every published opening as data (title, city, country, description, experience, date opened),
so one request reads the whole board.
"""

from __future__ import annotations

import html
import json
import re

from ..geo import country_code
from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

_DATA = re.compile(r'<input type="hidden" value="(\[\{&#34;[^"]*)"')


def _slug(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-")[:80] or "job"


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().strip("/")
    page = await http.get(f"https://{host}/jobs/Careers")
    if page.status_code != 200:
        return []
    openings: list[dict] = []
    for block in _DATA.findall(page.text):
        try:
            data = json.loads(html.unescape(block))
        except json.JSONDecodeError:
            continue
        if data and isinstance(data[0], dict) and "Posting_Title" in data[0]:
            openings = data
            break
    jobs = []
    for j in openings:
        if j.get("Publish") is False or not j.get("id"):
            continue
        title = (j.get("Posting_Title") or j.get("Job_Opening_Name") or "").strip()
        city, state, country = (j.get("City") or "").strip(), (j.get("State") or "").strip(), (j.get("Country") or "").strip()
        url = f"https://{host}/jobs/Careers/{j['id']}/{_slug(title)}?source=CareerSite"
        desc = html_to_text(j.get("Job_Description"))
        if j.get("Work_Experience"):
            desc = f"Experience: {j['Work_Experience']}\n\n{desc}"
        jobs.append(
            RawJob(
                external_id=str(j["id"]),
                title=title,
                job_url=url,
                apply_url=url,
                location_text=", ".join(x for x in (city, state, country) if x),
                country_hint=country_code(country) if country else None,
                city_hint=city or None,
                workplace_hint="remote" if j.get("Remote_Job") is True else None,
                posted_at=parse_time(j.get("Date_Opened")),
                description=desc[:20000],
                department=(j.get("Industry") or "") if isinstance(j.get("Industry"), str) else "",
            )
        )
    return jobs
