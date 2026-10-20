"""Avature career portals ({company}.avature.net, or a company host such as careers.bakermckenzie.com).

Token: "host|portal path", e.g. "careers.bakermckenzie.com|en_US/opportunities". The portal's SearchJobs
pages list jobs a few at a time (title, place, posting date); we step through them with jobOffset. Each
job's page has the full description, read for up to DETAILS_PER_RUN new jobs per run. Only pages the
portal's robots.txt allows are read.
"""

from __future__ import annotations

import asyncio
import html
import os
import re
from datetime import datetime, timezone
from urllib.robotparser import RobotFileParser

from ..http import USER_AGENT, Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from .jsonld import _postings

MAX_PAGES = 400
DETAILS_PER_RUN = int(os.environ.get("AVATURE_DETAILS_PER_RUN", "300"))
_ARTICLE = re.compile(r'<article class="article article--result.*?</article>', re.S)
_LINK = re.compile(r'<a[^>]+href="(https?://[^"]+/JobDetail/[^"]*?/(\d+))"[^>]*>(.*?)</a>', re.S)
_SPAN = re.compile(r'<span class="list-item-(\w+)">(.*?)</span>', re.S)
_DETAILS = re.compile(r'<article class="article article--details.*?</article>', re.S)
_FIELD = re.compile(r'__field__label">\s*(.*?)\s*</div>\s*<div class="article__content__view__field__value">\s*(.*?)\s*</div>', re.S)


def _txt(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def _date(s: str) -> datetime | None:
    for fmt in ("%d-%b-%Y", "%m/%d/%Y", "%d/%m/%Y", "%Y-%m-%d", "%b %d, %Y", "%d %b %Y"):
        try:
            return datetime.strptime(s.strip(), fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def _detail(raw: RawJob, page: str) -> None:
    posts = _postings(page)
    if posts:
        raw.description = html_to_text(posts[0].get("description"))[:20000]
        return
    parts = []
    for block in _DETAILS.findall(page):
        fields = {_txt(k).lower(): _txt(v) for k, v in _FIELD.findall(block)}
        if fields:
            place = fields.get("location") or fields.get("states/provinces/cities") or fields.get("city") or ""
            if place and not raw.location_text:
                raw.location_text = place
            kind = (fields.get("location type") or fields.get("workplace type") or "").lower()
            raw.workplace_hint = "remote" if "remote" in kind else "hybrid" if "hybrid" in kind else raw.workplace_hint
            continue
        body = re.sub(r'<h3[^>]*class="article__header__text__title[^"]*".*?</h3>', " ", block, flags=re.S)
        text = html_to_text(body)
        if len(text) > 80:
            parts.append(text)
    raw.description = "\n\n".join(parts)[:20000]


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host, portal = company.token.strip().split("|", 1)
    base = f"https://{host}/{portal.strip('/')}"
    rp = RobotFileParser()
    try:
        r = await http.get(f"https://{host}/robots.txt", attempts=1)
        rp.parse(r.text.splitlines() if r.status_code == 200 else [])
    except Exception:
        rp.parse([])

    found: dict[str, RawJob] = {}
    offset = 0
    for _ in range(MAX_PAGES):
        url = f"{base}/SearchJobs/?jobOffset={offset}"
        if not rp.can_fetch(USER_AGENT, url):
            break
        r = await http.get(url)
        if r.status_code != 200:
            break
        articles = _ARTICLE.findall(r.text)
        new = 0
        for art in articles:
            m = _LINK.search(art)
            if not m:
                continue
            link, jid, title = m.group(1), m.group(2), _txt(m.group(3))
            if not title or jid in found:
                continue
            spans = {k: _txt(v) for k, v in _SPAN.findall(art)}
            found[jid] = RawJob(
                external_id=jid,
                title=title,
                job_url=link,
                apply_url=link,
                location_text=spans.get("location", ""),
                posted_at=_date(spans.get("posted", "")),
            )
            new += 1
        if not new:
            break
        offset += len(articles)

    from ..normalize import job_id

    described = company.described or set()
    budget = DETAILS_PER_RUN
    sem = asyncio.Semaphore(3)

    async def one(raw: RawJob) -> RawJob:
        nonlocal budget
        if job_id(company, raw) in described:
            raw.touch_only = True
            return raw
        if budget <= 0 or not rp.can_fetch(USER_AGENT, raw.job_url):
            return raw
        budget -= 1
        try:
            async with sem:
                r = await http.get(raw.job_url)
            if r.status_code == 200:
                _detail(raw, r.text)
        except Exception:
            pass
        return raw

    return list(await asyncio.gather(*(one(j) for j in found.values())))
