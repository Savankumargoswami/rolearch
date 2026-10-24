"""Hireology career sites (careers.hireology.com/{company}): api.hireology.com/v2/public/careers/{company} lists every
open job with its description, locations, remote flag and pay, a page at a time. Token: the company's careers path.
"""

from __future__ import annotations

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time

API = "https://api.hireology.com/v2/public/careers"
PAGE = 100


def _salary(c: dict | None) -> Salary | None:
    if not isinstance(c, dict):
        return None
    period = {"hour": "hour", "year": "year", "month": "month", "annual": "year", "yearly": "year"}.get(str(c.get("comp_period") or "").lower())
    try:
        if c.get("is_comp_range"):
            lo, hi = float(c.get("comp_range_min") or 0), float(c.get("comp_range_max") or 0)
        else:
            lo = hi = float(c.get("comp_single_amount") or 0)
    except (TypeError, ValueError):
        return None
    return Salary(lo, hi, "USD", period) if lo > 0 and hi >= lo and period else None


def _to_raw(token: str, j: dict) -> RawJob:
    jid = str(j.get("id"))
    url = j.get("career_site_url") or f"https://careers.hireology.com/{token}/{jid}/description"
    locs = [x for x in (j.get("locations") or []) if isinstance(x, dict)]
    place = lambda x: ", ".join(p for p in [x.get("city"), x.get("state")] if p)  # noqa: E731
    first = locs[0] if locs else {}
    family = j.get("job_family") if isinstance(j.get("job_family"), dict) else {}
    return RawJob(
        external_id=jid,
        title=str(j.get("name") or "").strip(),
        job_url=url,
        apply_url=url,
        location_text=place(first),
        country_hint="US",
        city_hint=first.get("city") or None,
        workplace_hint="remote" if j.get("remote") is True else None,
        posted_at=parse_time(j.get("created_at")),
        description=html_to_text(j.get("job_description"))[:20000],
        salary=_salary(j.get("compensation")),
        department=str(family.get("name") or "") if family.get("name") != "General" else "",
        extra_locations=[place(x) for x in locs[1:6] if place(x)],
    )


async def jobs(http: Fetcher, token: str, limit: int | None = None) -> tuple[int, list[dict]]:
    out: list[dict] = []
    page, total = 1, 0
    while True:
        d = await http.json(f"{API}/{token}", params={"page": page, "page_size": PAGE if limit is None else min(PAGE, limit)})
        rows = d.get("data") or []
        total = int(d.get("count") or 0)
        out += [r for r in rows if str(r.get("status", "Open")).lower() == "open"]
        if limit is not None or not rows or page * PAGE >= total:
            return total, out
        page += 1


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    _, rows = await jobs(http, company.token)
    return [_to_raw(company.token, j) for j in rows]
