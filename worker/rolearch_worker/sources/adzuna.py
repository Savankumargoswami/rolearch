"""Adzuna Jobs API (developer.adzuna.com): jobs from many employers and boards, white- and blue-collar.

Needs ADZUNA_APP_ID and ADZUNA_APP_KEY. The free plan allows only a few thousand calls a month, so
each run spends a fixed budget per country (ADZUNA_CALLS_PER_COUNTRY, default 15): the newest 50 jobs
in each of the country's busiest categories. The worker runs Adzuna at most once a day, and keeps
Adzuna jobs open until they're 30 days old rather than closing whatever one run didn't fetch.
Adzuna returns a snippet, not the full description; Apply goes through Adzuna's link to the posting.
"""

from __future__ import annotations

import os

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ._util import parse_time

API = "https://api.adzuna.com/v1/api/jobs/{country}/{what}"
CURRENCY = {"us": "USD", "gb": "GBP", "ca": "CAD", "au": "AUD", "in": "INR", "de": "EUR", "fr": "EUR", "nl": "EUR",
            "it": "EUR", "es": "EUR", "at": "EUR", "be": "EUR", "nz": "NZD", "sg": "SGD", "za": "ZAR", "br": "BRL",
            "mx": "MXN", "pl": "PLN", "ch": "CHF"}
# Busiest categories first, so a small budget still covers most hiring.
PREFERRED = [
    "healthcare-nursing-jobs", "logistics-warehouse-jobs", "retail-jobs", "hospitality-catering-jobs", "sales-jobs",
    "it-jobs", "trade-construction-jobs", "customer-services-jobs", "admin-jobs", "accounting-finance-jobs",
    "engineering-jobs", "teaching-jobs", "manufacturing-jobs", "domestic-help-cleaning-jobs", "maintenance-jobs",
    "social-work-jobs", "hr-jobs", "legal-jobs", "pr-advertising-marketing-jobs", "creative-design-jobs",
    "scientific-qa-jobs", "graduate-jobs", "part-time-jobs", "other-general-jobs",
]


def _auth() -> dict:
    app_id, app_key = os.environ.get("ADZUNA_APP_ID", ""), os.environ.get("ADZUNA_APP_KEY", "")
    if not app_id or not app_key:
        raise RuntimeError("ADZUNA_APP_ID and ADZUNA_APP_KEY must be set")
    return {"app_id": app_id, "app_key": app_key}


def _to_raw(j: dict, country: str) -> RawJob | None:
    url = j.get("redirect_url") or ""
    if not j.get("id") or not url:
        return None
    loc = j.get("location") or {}
    area = loc.get("area") or []
    salary = None
    if str(j.get("salary_is_predicted", "0")) != "1" and j.get("salary_min") and j.get("salary_max"):
        salary = Salary(float(j["salary_min"]), float(j["salary_max"]), CURRENCY.get(country, "USD"), "year")
    return RawJob(
        external_id=str(j["id"]),
        title=(j.get("title") or "").strip(),
        job_url=url,
        apply_url=url,
        location_text=loc.get("display_name", ""),
        country_hint=country.upper() if country != "gb" else "GB",
        city_hint=area[-1] if len(area) >= 3 else None,
        posted_at=parse_time(j.get("created")),
        description=(j.get("description") or "").strip(),
        salary=salary,
        company_name=((j.get("company") or {}).get("display_name") or "").strip() or None,
        category_hint=(j.get("category") or {}).get("label"),
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    """company.token is the Adzuna country code (us, gb, ca, ...)."""
    country = company.token.lower()
    auth = _auth()
    budget = int(os.environ.get("ADZUNA_CALLS_PER_COUNTRY", "15"))
    cats = await http.json(API.format(country=country, what="categories"), params=auth)
    available = {c["tag"] for c in cats.get("results", [])}
    order = [t for t in PREFERRED if t in available] + sorted(available - set(PREFERRED))
    budget -= 1
    jobs: dict[str, RawJob] = {}
    for tag in order[:budget]:
        data = await http.json(
            API.format(country=country, what="search/1"),
            params={**auth, "category": tag, "results_per_page": 50, "sort_by": "date", "max_days_old": 14, "content-type": "application/json"},
        )
        for j in data.get("results", []):
            raw = _to_raw(j, country)
            if raw and raw.company_name and raw.external_id not in jobs:
                jobs[raw.external_id] = raw
    return list(jobs.values())
