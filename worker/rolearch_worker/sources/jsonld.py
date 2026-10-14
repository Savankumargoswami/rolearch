"""Fallback for careers pages on no supported ATS: read schema.org JobPosting JSON-LD.

Many careers sites embed JobPosting data for Google for Jobs. We fetch only the
careers URL listed for the company (and job pages it links to on the same site),
and only when robots.txt allows our user agent.
"""

from __future__ import annotations

import json
import re
from urllib.parse import urljoin, urlsplit
from urllib.robotparser import RobotFileParser

from ..http import USER_AGENT, Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time, period_of

MAX_JOB_PAGES = 60
_ld = re.compile(r'<script[^>]+type=["\']application/ld\+json["\'][^>]*>(.*?)</script>', re.S | re.I)
_href = re.compile(r'href=["\']([^"\'#]+)["\']', re.I)
_jobish = re.compile(r"/(jobs?|careers?|positions?|openings?|vacanc(y|ies)|roles?)/[^/?]+", re.I)


async def _allowed(http: Fetcher, url: str) -> bool:
    parts = urlsplit(url)
    rp = RobotFileParser()
    try:
        r = await http.get(f"{parts.scheme}://{parts.netloc}/robots.txt", attempts=1)
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except Exception:
        rp.parse([])
    return rp.can_fetch(USER_AGENT, url)


def _postings(html: str) -> list[dict]:
    found = []
    for block in _ld.findall(html):
        try:
            data = json.loads(block.strip())
        except json.JSONDecodeError:
            continue
        stack = data if isinstance(data, list) else [data]
        while stack:
            node = stack.pop()
            if isinstance(node, dict):
                if node.get("@type") == "JobPosting" or (isinstance(node.get("@type"), list) and "JobPosting" in node["@type"]):
                    found.append(node)
                stack.extend(v for v in node.values() if isinstance(v, (dict, list)))
            elif isinstance(node, list):
                stack.extend(node)
    return found


def _to_raw(p: dict, page_url: str) -> RawJob:
    loc = p.get("jobLocation") or {}
    loc = loc[0] if isinstance(loc, list) and loc else loc
    addr = (loc or {}).get("address") or {}
    country = addr.get("addressCountry")
    if isinstance(country, dict):
        country = country.get("name")
    salary = None
    base = p.get("baseSalary") or {}
    val = base.get("value") or {}
    if isinstance(val, dict) and val.get("minValue") and val.get("maxValue") and base.get("currency"):
        salary = Salary(float(val["minValue"]), float(val["maxValue"]), base["currency"], period_of(val.get("unitText")))
    url = p.get("url") or page_url
    ident = p.get("identifier")
    if isinstance(ident, dict):
        ident = ident.get("value")
    return RawJob(
        external_id=str(ident or url),
        title=(p.get("title") or "").strip(),
        job_url=url,
        apply_url=url,
        location_text=", ".join(x for x in (addr.get("addressLocality"), addr.get("addressRegion"), country) if x),
        city_hint=addr.get("addressLocality"),
        workplace_hint="remote" if p.get("jobLocationType") == "TELECOMMUTE" else None,
        posted_at=parse_time(p.get("datePosted")),
        description=html_to_text(p.get("description")),
        salary=salary,
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    start = company.careers_url
    if not start or not await _allowed(http, start):
        return []
    r = await http.get(start)
    r.raise_for_status()
    jobs = [_to_raw(p, start) for p in _postings(r.text)]
    if jobs:
        return jobs
    # The listing page has no JSON-LD: follow same-site job links and read each job page.
    host = urlsplit(start).netloc
    links = []
    for href in _href.findall(r.text):
        url = urljoin(start, href)
        if urlsplit(url).netloc == host and _jobish.search(urlsplit(url).path) and url not in links and url != start:
            links.append(url)
    for url in links[:MAX_JOB_PAGES]:
        if not await _allowed(http, url):
            continue
        try:
            page = await http.get(url)
        except Exception:
            continue
        if page.status_code == 200:
            jobs.extend(_to_raw(p, url) for p in _postings(page.text))
    return jobs
