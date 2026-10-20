"""Vi (viRecruit) self-apply portals, used by many law firms ({firm}.viglobalcloud.com).

Token: the portal host, e.g. "selfapplygibsondunn.viglobalcloud.com", or host/app path when the portal
isn't the usual self-apply app (e.g. "videsktop.littler.com/viRecruitSearchFirm"). The portal's RecDefault page lists
every open position for one job category at a time (title, office, practice area, posting date and the
full description); the other categories are the same page re-posted with the category dropdown changed.
Jobs have no page of their own, so each links to the firm's portal.
"""

from __future__ import annotations

import hashlib
import html
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

_ROW = re.compile(r"<td>\s*<h4>(.*?)</h4>(.*?)</td>", re.S)
_SUB = re.compile(r"<h5>\s*([^<]+?)\s*<span>(.*?)</span>\s*</h5>", re.S)
_DESC = re.compile(r'<section class="description">(.*?)</section>', re.S)
_HIDDEN = re.compile(r'<input[^>]+type="hidden"[^>]*>', re.S)
_SELECT = re.compile(r'<select name="([^"]*ddListFilterJobCategory)"[^>]*>(.*?)</select>', re.S)
_OPTION = re.compile(r'<option(?: selected="selected")? value="([^"]+)"', re.S)


def _txt(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip()


def _attr(tag: str, name: str) -> str:
    m = re.search(rf'{name}="([^"]*)"', tag)
    return html.unescape(m.group(1)) if m else ""


def _rows(page: str, url: str, category: str) -> list[RawJob]:
    out = []
    for title, body in _ROW.findall(page):
        title = _txt(title)
        if not title:
            continue
        sub = {_txt(k).lower(): _txt(v) for k, v in _SUB.findall(body)}
        desc = _DESC.search(body)
        posted = None
        try:
            posted = datetime.strptime(sub.get("date posted", ""), "%b %d, %Y").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
        office = sub.get("office") or sub.get("location") or ""
        key = hashlib.sha1(f"{title}|{office}|{sub.get('date posted', '')}".encode()).hexdigest()[:16]
        out.append(RawJob(
            external_id=key,
            title=title,
            job_url=url,
            apply_url=url,
            location_text=office,
            posted_at=posted,
            description=html_to_text(desc.group(1))[:20000] if desc else "",
            department=re.sub(r"^-.*-$", "", sub.get("practice area") or sub.get("department") or category),
        ))
    return out


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    token = company.token.strip().strip("/")
    app = token if "/" in token else f"{token}/viRecruitSelfApply"
    first = await http.get(f"https://{app}/RecDefault.aspx")
    if first.status_code != 200:
        return []
    url = str(first.url)
    page = first.text
    jobs = {j.external_id: j for j in _rows(page, url, "")}

    sel = _SELECT.search(page)
    if sel:
        field, options = sel.group(1), sel.group(2)
        current = re.search(r'<option selected="selected" value="([^"]+)"', options)
        form = {_attr(t, "name"): _attr(t, "value") for t in _HIDDEN.findall(page) if _attr(t, "name")}
        for value in _OPTION.findall(options):
            if current and value == current.group(1):
                continue
            data = dict(form)
            data.update({"__EVENTTARGET": "ctl00$contentPlaceHolder$buttonSearch", "__EVENTARGUMENT": "", field: value})
            office = re.search(r'<select name="([^"]*ddListFilterOffice)"', page)
            if office:
                data[office.group(1)] = "-1"
            try:
                r = await http.post_form(url, data)
            except Exception:
                continue
            if r.status_code == 200:
                for j in _rows(r.text, url, ""):
                    jobs.setdefault(j.external_id, j)
    return list(jobs.values())
