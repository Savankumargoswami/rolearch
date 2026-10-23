"""Job feeds employers connect on Rolearch (company dashboard -> "Connect your job feed"), db/023_employer_feeds.sql.

Token: the feed's id; careers_url: its address. Reads the feed formats hiring systems produce for job boards:
Indeed-style XML (<source><job>...), RSS (<item>) and Atom (<entry>). Every job is listed under the account's own
company whatever the feed says, so a feed can't post jobs for other employers. Only public https addresses are read,
up to MAX_BYTES.
"""

from __future__ import annotations

import ipaddress
import re
import socket
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from urllib.parse import urlsplit

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text
from ._util import parse_time

MAX_BYTES = 15_000_000
MAX_JOBS = 5000


def public_https(url: str) -> bool:
    """True for https addresses whose host resolves only to public internet addresses."""
    parts = urlsplit(url)
    if parts.scheme != "https" or not parts.hostname:
        return False
    try:
        infos = socket.getaddrinfo(parts.hostname, 443)
    except OSError:
        return False
    return all(ipaddress.ip_address(i[4][0]).is_global for i in infos)


def _date(value: str | None):
    """ISO dates, RSS/Indeed dates ("Wed, 22 Oct 2026 10:00:00 GMT") and US dates ("10/22/2026")."""
    if not value:
        return None
    iso = parse_time(value)
    if iso:
        return iso
    try:
        return parsedate_to_datetime(value).astimezone(timezone.utc)
    except (TypeError, ValueError, IndexError):
        pass
    try:
        return datetime.strptime(value.strip()[:10], "%m/%d/%Y").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


_SUFFIX = re.compile(r"\b(inc|llc|ltd|limited|corp(oration)?|co|company|group|holdings|plc|lp|llp|the)\b\.?", re.I)


def same_employer(a: str, b: str) -> bool:
    """'Acme, Inc.' and 'ACME' are the same employer; 'Stripe' and 'Acme' aren't."""
    norm = lambda s: re.sub(r"[^a-z0-9]+", " ", _SUFFIX.sub(" ", s.lower())).strip()  # noqa: E731
    x, y = norm(a), norm(b)
    return bool(x and y) and (x == y or x.startswith(y) or y.startswith(x))


def _local(tag: str) -> str:
    return tag.rsplit("}", 1)[-1].lower()


def _fields(el: ET.Element) -> dict[str, str]:
    out: dict[str, str] = {}
    for child in el:
        name = _local(child.tag)
        if name == "link" and child.get("href"):  # Atom
            out.setdefault("link", child.get("href", ""))
            continue
        text = "".join(child.itertext()).strip()
        if text and name not in out:
            out[name] = text
    return out


def parse(xml: bytes) -> list[dict[str, str]]:
    """Each posting's fields, from Indeed-style XML, RSS or Atom."""
    # Feeds have no business declaring entities; refuse them rather than expand them.
    if re.search(rb"<!(DOCTYPE|ENTITY)", xml[:4096], re.I):
        raise ValueError("feed declares a DOCTYPE or entities")
    root = ET.fromstring(xml)
    items = [e for e in root.iter() if _local(e.tag) in ("job", "item", "entry")]
    return [_fields(e) for e in items[:MAX_JOBS]]


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    url = company.careers_url
    if not public_https(url):
        raise ValueError("feed address must be a public https link")
    r = await http.get(url, attempts=2)
    r.raise_for_status()
    if len(r.content) > MAX_BYTES:
        raise ValueError("feed is larger than 15 MB")
    jobs = []
    for f in parse(r.content):
        # A feed may only bring in the account's own jobs: skip postings that name another employer
        # (e.g. someone pasting a job board's feed).
        if f.get("company") and not same_employer(f["company"], company.name):
            continue
        title = f.get("title", "").strip()
        link = f.get("url") or f.get("link") or ""
        if not title or not link.startswith(("https://", "http://")):
            continue
        place = ", ".join(x for x in (f.get("city"), f.get("state"), f.get("country")) if x) or f.get("location", "")
        remote = (f.get("remotetype") or f.get("remote") or "").lower()
        jobs.append(
            RawJob(
                external_id=f.get("referencenumber") or f.get("requisitionid") or f.get("guid") or f.get("id") or link,
                title=title,
                job_url=link,
                apply_url=link,
                location_text=place,
                country_hint=(f.get("country") or "").upper() if len(f.get("country") or "") == 2 else None,
                city_hint=f.get("city"),
                workplace_hint="remote" if "remote" in remote or remote in ("yes", "true", "fully remote") else None,
                posted_at=_date(f.get("date") or f.get("pubdate") or f.get("published") or f.get("updated")),
                description=html_to_text(f.get("description") or f.get("summary") or f.get("content") or "")[:20000],
                department=f.get("category") or f.get("department") or "",
            )
        )
    return jobs
