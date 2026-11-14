"""Career sites run on WordPress, read through the WordPress REST API (Publix: jobs.publix.com).

Token: "api base|post type|public host", e.g. "wpvip.publix.com/jobs|job_opening|jobs.publix.com".
/wp-json/wp/v2/{post type} returns 100 jobs a page with the full description; places are terms of the
site's job_location taxonomy, read once per run. Job links are rewritten to the public career site.
"""

from __future__ import annotations

import asyncio
import html
from datetime import datetime, timezone

from ..http import Fetcher
from ..models import Company, RawJob
from ..text import html_to_text

PAGE = 100
_FIELDS = "id,slug,link,title,content,date_gmt,meta,job_location"
_EVERYWHERE = ("all retail locations", "all locations", "multiple locations")


def _date(s: str | None) -> datetime | None:
    try:
        return datetime.fromisoformat(s).replace(tzinfo=timezone.utc) if s else None
    except ValueError:
        return None


async def _pages(http: Fetcher, url: str, params: dict) -> list[dict]:
    first = await http.get(url, params={**params, "per_page": PAGE, "page": 1})
    first.raise_for_status()
    pages = int(first.headers.get("x-wp-totalpages") or 1)
    # No return_exceptions: a failed page fails the run, so a partial list never closes open jobs.
    rest = await asyncio.gather(*(http.json(url, params={**params, "per_page": PAGE, "page": n}) for n in range(2, pages + 1)))
    return first.json() + [x for p in rest for x in p]


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    base, post_type, public = (p.strip().strip("/") for p in company.token.split("|"))
    api = f"https://{base}/wp-json/wp/v2"
    posts, terms = await asyncio.gather(_pages(http, f"{api}/{post_type}", {"_fields": _FIELDS}), _pages(http, f"{api}/job_location", {"_fields": "id,name"}))
    places = {t["id"]: html.unescape(t["name"]) for t in terms}
    jobs = []
    for p in posts:
        title = html.unescape((p.get("title") or {}).get("rendered") or "").strip()
        link = (p.get("link") or "").replace(f"https://{base}/", f"https://{public}/")
        if not title or not link:
            continue
        names = [places[i] for i in p.get("job_location") or [] if i in places]
        named = [n for n in names if n.lower() not in _EVERYWHERE]
        meta = p.get("meta") or {}
        jobs.append(
            RawJob(
                external_id=str(meta.get("job_id") or p["id"]),
                title=title,
                job_url=link,
                apply_url=meta.get("apply_url") or link,
                location_text=named[0] if named else "",
                city_hint=named[0].split(",")[0].strip() if named else None,
                extra_locations=named[1:],
                posted_at=_date(p.get("date_gmt")),
                description=html_to_text((p.get("content") or {}).get("rendered") or "")[:20000],
            )
        )
    return jobs
