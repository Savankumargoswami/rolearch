"""SAP SuccessFactors career sites (Recruiting Marketing, e.g. jobs.exxonmobil.com).

Token: the career site's host, e.g. "jobs.exxonmobil.com". Most sites publish every open job, with its
full description, as an RSS feed at /sitemap.xml: one request for the whole board. Sites without the
feed are read from their search pages (25 jobs a page; titles, places and dates, no descriptions).
"""

from __future__ import annotations

import asyncio
import html
import os
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

MAX_PAGES = 200
DETAILS_PER_RUN = int(os.environ.get("SUCCESSFACTORS_DETAILS_PER_RUN", "400"))
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


_PROP = lambda name: re.compile(rf'itemprop="{name}"[^>]*?(?:content="([^"]*)"[^>]*>|>(.*?)</)', re.S)
_TITLE, _DESC, _CITY, _REGION, _COUNTRY, _DATE = (_PROP(n) for n in ("title", "description", "addressLocality", "addressRegion", "addressCountry", "datePosted"))


_DESC_START = re.compile(r'<(span|div)[^>]*itemprop="description"')
_TAG = re.compile(r"<(/?)(span|div)[^>]*?(/?)>", re.I)


def _element(page: str, start: int) -> str:
    """Inner HTML of the span/div opening at `start`, matching nested span/div tags."""
    depth, body_start = 0, None
    for m in _TAG.finditer(page, start):
        if m.group(3):
            continue
        if body_start is None:
            body_start = m.end()
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return page[body_start:m.start()]
    return page[body_start or start:]
_LABEL = re.compile(r'class="joblayouttoken-label"[^>]*>(.*?)</span>\s*<span[^>]*>(.*?)</span>', re.S)


def _prop(rx: re.Pattern[str], page: str) -> str:
    m = rx.search(page)
    return html.unescape((m.group(1) or m.group(2) or "").strip()) if m else ""


def _from_job_page(page: str, url: str) -> RawJob | None:
    """A job page's schema.org microdata (itemprop="title", "description", ...)."""
    title = re.sub(r"<[^>]+>", "", _prop(_TITLE, page)).strip()
    if not title:
        return None
    # Career Site Builder pages can carry several description blocks (intro, body, footer): keep the fullest.
    blocks = [html_to_text(_element(page, m.start())) for m in _DESC_START.finditer(page)]
    description = max(blocks, key=len, default="")
    city, region, country = _prop(_CITY, page), _prop(_REGION, page), _prop(_COUNTRY, page)
    if not (city or region or country):
        # Builder pages label fields instead ("Posting City:", "Job Country:", "Location:").
        fields = {re.sub(r"\s+", " ", k).strip(" :").lower(): html.unescape(re.sub(r"<[^>]+>", "", v)).strip() for k, v in _LABEL.findall(page)}
        city = next((fields[k] for k in fields if "city" in k), "") or fields.get("location", "")
        region = next((fields[k] for k in fields if "state" in k or "province" in k), "")
        country = next((fields[k] for k in fields if "country" in k), "")
        if not (city or country):
            m = re.search(r"\s[-–]\s([A-Za-z .'-]+,\s?[A-Z]{2})$", title)
            city = m.group(1) if m else ""
    jid = re.search(r"/(\d+)/?$", url)
    return RawJob(
        external_id=jid.group(1) if jid else url,
        title=title,
        job_url=url,
        apply_url=url,
        location_text=", ".join(dict.fromkeys(x for x in (city, region, country) if x)),
        city_hint=city.split(",")[0].strip().title() or None,
        country_hint=country.upper() if re.fullmatch(r"[A-Za-z]{2}", country) else None,
        posted_at=_date(_prop(_DATE, page)),
        description=description[:20000],
    )


async def _from_sitemap(http: Fetcher, company: Company, host: str) -> list[RawJob]:
    """Sites with neither the feed nor working search pages: job URLs from the sitemap, details from each page."""
    from .sitemap import job_urls
    urls = await job_urls(http, f"https://{host}/sitemap.xml")
    known = company.known_urls or {}
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(4)

    async def one(url: str) -> RawJob | None:
        nonlocal budget
        if url in known:
            jid = re.search(r"/(\d+)/?$", url)
            return RawJob(external_id=jid.group(1) if jid else url, title=known[url], job_url=url, apply_url=url, touch_only=True)
        if budget <= 0:
            return None
        budget -= 1
        try:
            async with sem:
                r = await http.get(url, attempts=2)
            return _from_job_page(r.text, url) if r.status_code == 200 else None
        except Exception:
            return None

    return [r for r in await asyncio.gather(*(one(u) for u in urls)) if r]


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().lower()
    feed = await http.get(f"https://{host}/sitemap.xml")
    if feed.status_code == 200 and "<item>" in feed.text:
        jobs = _from_feed(feed.text, host)
        if jobs:
            return jobs

    first = await http.get(f"https://{host}/search/", params={"q": "", "startrow": 0})
    if first.status_code != 200:
        return await _from_sitemap(http, company, host)
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
    if unique:
        return list(unique.values())
    return await _from_sitemap(http, company, host)
