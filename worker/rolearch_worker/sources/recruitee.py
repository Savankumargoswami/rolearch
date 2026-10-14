"""Recruitee careers API: {company}.recruitee.com/api/offers/ (public)."""

from __future__ import annotations

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ..text import html_to_text
from ._util import parse_time, period_of


def _salary(s: dict | None) -> Salary | None:
    s = s or {}
    lo, hi, cur = s.get("min"), s.get("max"), s.get("currency")
    try:
        return Salary(float(lo), float(hi), cur, period_of(s.get("period"))) if lo and hi and cur else None
    except (TypeError, ValueError):
        return None


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    data = await http.json(f"https://{company.token}.recruitee.com/api/offers/")
    jobs = []
    for o in data.get("offers", []):
        if o.get("status") not in (None, "published"):
            continue
        workplace = "remote" if o.get("remote") else "hybrid" if o.get("hybrid") else "onsite" if o.get("on_site") else None
        jobs.append(
            RawJob(
                external_id=str(o["id"]),
                title=(o.get("title") or "").strip(),
                job_url=o.get("careers_url", ""),
                apply_url=o.get("careers_apply_url") or o.get("careers_url", ""),
                location_text=o.get("location") or ", ".join(x for x in (o.get("city"), o.get("country")) if x),
                country_hint=(o.get("country_code") or "").upper() or None,
                city_hint=o.get("city"),
                workplace_hint=workplace,
                posted_at=parse_time(o.get("published_at") or o.get("created_at")),
                description=f"{html_to_text(o.get('description'))}\n\n{html_to_text(o.get('requirements'))}".strip(),
                salary=_salary(o.get("salary")),
                department=o.get("department") or "",
            )
        )
    return jobs
