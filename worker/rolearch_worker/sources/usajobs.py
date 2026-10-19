"""USAJOBS Search API (data.usajobs.gov): every open US federal job announcement.

Needs USAJOBS_API_KEY and USAJOBS_EMAIL (the address the key was registered to, sent as the
User-Agent as the API requires). Each search returns at most 10,000 results, so we search state by
state (plus once with no location, for overseas and nationwide postings) and dedupe by PositionID.
"""

from __future__ import annotations

import os

from ..http import Fetcher
from ..models import Company, RawJob, Salary
from ._util import parse_time

API = "https://data.usajobs.gov/api/search"
PER_PAGE = 500
STATES = [
    "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", "District of Columbia",
    "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", "Louisiana", "Maine",
    "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", "Missouri", "Montana", "Nebraska", "Nevada",
    "New Hampshire", "New Jersey", "New Mexico", "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon",
    "Pennsylvania", "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", "Virginia",
    "Washington", "West Virginia", "Wisconsin", "Wyoming", "Puerto Rico", "Guam",
]


def _headers() -> dict:
    key, email = os.environ.get("USAJOBS_API_KEY", ""), os.environ.get("USAJOBS_EMAIL", "")
    if not key or not email:
        raise RuntimeError("USAJOBS_API_KEY and USAJOBS_EMAIL must be set")
    return {"Host": "data.usajobs.gov", "User-Agent": email, "Authorization-Key": key}


def _to_raw(m: dict) -> RawJob | None:
    pid = m.get("PositionID") or ""
    url = m.get("PositionURI") or ""
    if not pid or not url:
        return None
    locs = m.get("PositionLocation") or []
    first = locs[0] if locs else {}
    details = (m.get("UserArea") or {}).get("Details") or {}
    pay = (m.get("PositionRemuneration") or [{}])[0]
    salary = None
    try:
        lo, hi = float(pay.get("MinimumRange") or 0), float(pay.get("MaximumRange") or 0)
        period = {"PA": "year", "PH": "hour", "PM": "month"}.get(pay.get("RateIntervalCode", ""))
        if lo and hi and period:
            salary = Salary(lo, hi, "USD", period)
    except (TypeError, ValueError):
        pass
    duties = details.get("MajorDuties") or []
    description = "\n\n".join(
        part
        for part in [
            details.get("JobSummary", ""),
            "\n".join(duties) if isinstance(duties, list) else str(duties),
            m.get("QualificationSummary", ""),
            details.get("Education", ""),
            details.get("Requirements", ""),
        ]
        if part
    )
    remote = str(details.get("RemoteIndicator", "")).lower() == "true"
    telework = str(details.get("TeleworkEligible", "")).lower() == "true"
    country = first.get("CountryCode", "")
    return RawJob(
        external_id=str(pid),
        title=(m.get("PositionTitle") or "").strip(),
        job_url=url,
        apply_url=((m.get("ApplyURI") or [url])[0]) or url,
        location_text=first.get("LocationName", "") or m.get("PositionLocationDisplay", ""),
        country_hint="US" if "united states" in country.lower() or country.upper() == "US" else None,
        city_hint=first.get("CityName", "").split(",")[0].strip() or None,
        workplace_hint="remote" if remote else "hybrid" if telework else "onsite",
        posted_at=parse_time(m.get("PublicationStartDate")),
        description=description,
        salary=salary,
        department=m.get("DepartmentName", ""),
        extra_locations=[x.get("LocationName", "") for x in locs[1:6]],
        company_name=m.get("OrganizationName") or m.get("DepartmentName") or "US Government",
        category_hint=", ".join(c.get("Name", "") for c in m.get("JobCategory") or []),
    )


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    headers = _headers()
    seen: dict[str, RawJob] = {}
    for location in [None, *STATES]:
        page = 1
        while True:
            params = {"ResultsPerPage": PER_PAGE, "Page": page, "Fields": "Full"}
            if location:
                params["LocationName"] = location
            data = await http.json(API, params=params, headers=headers)
            result = data.get("SearchResult") or {}
            items = result.get("SearchResultItems") or []
            for item in items:
                raw = _to_raw(item.get("MatchedObjectDescriptor") or {})
                if raw and raw.external_id not in seen:
                    seen[raw.external_id] = raw
            total = int(result.get("SearchResultCountAll") or 0)
            if not items or page * PER_PAGE >= min(total, 10_000):
                break
            page += 1
    return list(seen.values())
