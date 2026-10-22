"""Frontline AppliTrack, used by thousands of US school districts: www.applitrack.com/{district}/onlineapp.

Token: "{district}|{Town, State}", e.g. "isd742|Waite Park, Minnesota". The district's public
jobpostings/Output.asp?all=1 page lists every open posting with its full description in one request.
Each posting names a school or department as its location; the district's town is added so it can be placed.
"""

from __future__ import annotations

import html
import re
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

_POSTING = re.compile(r"<ul class='postingsList' id='p(\d+)_'>(.*?)(?=<ul class='postingsList' id='p\d+_'>|$)", re.S)
_TITLE = re.compile(r"<td id='wrapword'[^>]*>(.*?)</td>", re.S)
_FIELD = re.compile(r"<span class=['\"]label['\"]\s*>\s*([^<:]+):\s*</span>(.*?)</li>", re.S)
_DESC = re.compile(r"<span id='DescriptionText\d+_'[^>]*>(.*?)<img src='https://www\.applitrack\.com/clear\.gif'", re.S)


def _txt(s: str) -> str:
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", s))).strip(" /")


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    district, _, town = company.token.partition("|")
    base = f"https://www.applitrack.com/{district}/onlineapp"
    r = await http.get(f"{base}/jobpostings/Output.asp", params={"all": "1"})
    if r.status_code != 200:
        return []
    # The page is JavaScript that writes HTML: undo its string escaping first.
    page = r.text.replace("\\'", "'").replace('\\"', '"').replace("\\/", "/")
    jobs = []
    for jid, block in _POSTING.findall(page):
        title = _TITLE.search(block)
        if not title:
            continue
        fields = {_txt(k).lower(): _txt(v) for k, v in _FIELD.findall(block)}
        posted = None
        try:
            posted = datetime.strptime(fields.get("date posted", ""), "%m/%d/%Y").replace(tzinfo=timezone.utc)
        except ValueError:
            pass
        school = fields.get("location", "")
        desc = _DESC.search(block)
        url = f"{base}/default.aspx?AppliTrackJobId={jid}&AppliTrackLayoutMode=detail&AppliTrackViewPosting=1"
        jobs.append(
            RawJob(
                external_id=jid,
                title=_txt(title.group(1)),
                job_url=url,
                apply_url=url,
                location_text=", ".join(x for x in (school, town) if x),
                country_hint="US",
                city_hint=town.split(",")[0].strip() or None,
                posted_at=posted,
                description=html_to_text(desc.group(1))[:20000] if desc else "",
                department=fields.get("position type", ""),
                category_hint=fields.get("position type") or None,
            )
        )
    return jobs
