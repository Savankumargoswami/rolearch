"""SAP SuccessFactors career sites (Recruiting Marketing, e.g. jobs.exxonmobil.com).

Token: the career site's host, e.g. "jobs.exxonmobil.com". Most sites publish every open job, with its
full description, as an RSS feed at /sitemap.xml: one request for the whole board. Sites without the
feed are read from their search pages (25 jobs a page; titles, places and dates, no descriptions).
"""

from __future__ import annotations

import asyncio
import html
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

MAX_PAGES = 200
_ITEM = re.compile(r"<item>(.*?)</item>", re.S)
_ROW = re.compile(r'<tr class="data-row">(.*?)</tr>', re.S)


def _tag(block: str, name: str) -> str:
    m = re.search(rf"<{name}>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?</{name}>", block, re.S)
    return html.unescape(m.group(1)).strip() if m else ""


def place(loc: str) -> tuple[str, str | None, str | None]:
    """'Singapore, SG, 469269' -> ('Singapore, SG', 'Singapore', 'SG'); 'Houston, TX, US, 77002' -> (..., 'Houston', 'US')."""
    parts = [p.strip() for p in loc.split(",") if p.strip()]
    codes = [p for p in parts[1:] if re.fullmatch(r"[A-Z]{2}", p)]
    country = codes[-1] if codes else None
    city = parts[0] if parts else None
    text = ", ".join(p for p in parts if not re.fullmatch(r"[\dA-Z -]{3,10}", p) or re.fullmatch(r"[A-Z]{2}", p))
    return text or loc, city, country


def _date(s: str) -> datetime | None:
    if not s:
        return None
    for parse in (parsedate_to_datetime, lambda v: datetime.strptime(v.strip(), "%b %d, %Y").replace(tzinfo=timezone.utc)):
        try:
            d = parse(s)
            return d if d.tzinfo else d.replace(tzinfo=timezone.utc)
        except (TypeError, ValueError, IndexError):
            continue
    return None


def _from_feed(xml: str, host: str) -> list[RawJob]:
    jobs = []
    for block in _ITEM.findall(xml):
        link = _tag(block, "link")
        jid = _tag(block, "g:id") or _tag(block, "guid") or link
        loc = _tag(block, "g:location")
        title = re.sub(r"\s*\([^()]*\)\s*$", "", _tag(block, "title")) if loc else _tag(block, "title")
        if not link or not title:
            continue
        text, city, country = place(loc)
        jobs.append(
            RawJob(
                external_id=jid,
                title=title,
                job_url=link,
                apply_url=link,
                location_text=text,
                city_hint=city,
                country_hint=country,
                posted_at=_date(_tag(block, "pubDate")),
                description=html_to_text(_tag(block, "description"))[:20000],
                department=_tag(block, "g:job_function"),
            )
        )
    return jobs


def _from_page(page: str, host: str) -> list[RawJob]:
    jobs = []
    for row in _ROW.findall(page):
        m = re.search(r'<a[^>]*href="(/job/[^"]+)"[^>]*class="jobTitle-link"[^>]*>(.*?)</a>|<a[^>]*class="jobTitle-link"[^>]*href="(/job/[^"]+)"[^>]*>(.*?)</a>', row, re.S)
        if not m:
            continue
        path = m.group(1) or m.group(3)
        title = html.unescape(re.sub(r"<[^>]+>", "", m.group(2) or m.group(4) or "")).strip()
        loc_m = re.search(r'<span class="jobLocation">\s*(.*?)\s*</span>', row, re.S)
        date_m = re.search(r'<span class="jobDate[^"]*">\s*(.*?)\s*</span>', row, re.S)
        jid = re.search(r"/(\d+)/?$", path)
        text, city, country = place(html.unescape(loc_m.group(1)).strip() if loc_m else "")
        url = f"https://{host}{path}"
        jobs.append(
            RawJob(
                external_id=jid.group(1) if jid else path,
                title=title,
                job_url=url,
                apply_url=url,
                location_text=text,
                city_hint=city,
                country_hint=country,
                posted_at=_date(html.unescape(date_m.group(1)) if date_m else ""),
            )
        )
    return jobs


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower()
    feed = await http.get(f"https://{host}/sitemap.xml")
    if feed.status_code == 200 and "<item>" in feed.text:
        jobs = _from_feed(feed.text, host)
        if jobs:
            return jobs

    first = await http.get(f"https://{host}/search/", params={"q": "", "startrow": 0})
    first.raise_for_status()
    total_m = re.search(r"of\s*<b>\s*([\d,]+)\s*</b>", first.text)
    total = int(total_m.group(1).replace(",", "")) if total_m else 0
    jobs = _from_page(first.text, host)
    step = len(jobs) or 25
    pages = await asyncio.gather(
        *(http.get(f"https://{host}/search/", params={"q": "", "startrow": s}) for s in range(step, min(total, step * MAX_PAGES), step)),
        return_exceptions=True,
    )
    for p in pages:
        if not isinstance(p, Exception) and p.status_code == 200:
            jobs.extend(_from_page(p.text, host))
    unique: dict[str, RawJob] = {}
    for j in jobs:
        unique.setdefault(j.external_id, j)
    return list(unique.values())
