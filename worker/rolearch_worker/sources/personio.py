"""Personio XML feed: {company}.jobs.personio.de/xml (public)."""

from __future__ import annotations

import xml.etree.ElementTree as ET

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    base = f"https://{company.token}.jobs.personio.de"
    r = await http.get(f"{base}/xml", params={"language": "en"})
    r.raise_for_status()
    root = ET.fromstring(r.content)
    jobs = []
    for p in root.findall("position"):
        pid = (p.findtext("id") or "").strip()
        if not pid:
            continue
        desc = "\n\n".join(
            f"{d.findtext('name') or ''}\n{html_to_text(d.findtext('value'))}" for d in p.findall("jobDescriptions/jobDescription")
        )
        url = f"{base}/job/{pid}"
        jobs.append(
            RawJob(
                external_id=pid,
                title=(p.findtext("name") or "").strip(),
                job_url=url,
                apply_url=f"{url}#apply",
                location_text=p.findtext("office") or "",
                posted_at=parse_time(p.findtext("createdAt")),
                description=desc.strip(),
                department=p.findtext("department") or "",
                extra_locations=[o.text or "" for o in p.findall("additionalOffices/office")],
            )
        )
    return jobs
