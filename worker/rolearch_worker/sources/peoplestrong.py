"""PeopleStrong career portals, used by many large Indian groups: {company}careers.peoplestrong.com.

Token: the portal host, e.g. "abfrlcareers.peoplestrong.com". The portal's job list loads from
POST /api/cp/rest/altone/cp/jobs/v1 (public; the host has no robots.txt), giving each job's title, location path
("India>South>Tamil Nadu>Tiruppur>..."), posting date, experience range and skills. The list has no description;
each job links to its own page on the portal.
"""

from __future__ import annotations

from ..http import Fetcher
from ..models import Company, RawJob
from ._util import parse_time

PAGE = 100
MAX_JOBS = 8000


STATES = {
    "andhra pradesh", "arunachal pradesh", "assam", "bihar", "chhattisgarh", "goa", "gujarat", "haryana", "himachal pradesh",
    "jharkhand", "karnataka", "kerala", "madhya pradesh", "maharashtra", "manipur", "meghalaya", "mizoram", "nagaland", "odisha",
    "punjab", "rajasthan", "sikkim", "tamil nadu", "telangana", "tripura", "uttar pradesh", "uttarakhand", "west bengal",
    "delhi", "jammu and kashmir", "ladakh", "puducherry", "chandigarh", "andaman and nicobar islands", "dadra and nagar haveli and daman and diu", "lakshadweep",
}
_GENERIC = {"na", "coco", "head office", "ho", "corporate office", "corporate", "south", "north", "east", "west", "central", "asia", "india", "all", "pan india"}


def _real_place(p: str) -> bool:
    return p.lower() not in _GENERIC and not any(c.isdigit() for c in p) and len(p) > 2


def _place(path: str, city: str) -> tuple[str, str]:
    """Location paths vary by company ("India>South>Tamil Nadu>Tiruppur>NA>COCO>P540-...",
    "Asia>India>South>HO>Andhra Pradesh>Head Office>Chittoor>Tirupati>Head Office"): pick the country and the
    Indian state by name, and the most specific real place as the town."""
    parts = [p.strip() for p in (path or "").split(">") if p.strip()]
    india = any(p.lower() == "india" for p in parts)
    state = next((p for p in parts if p.lower() in STATES), "")
    town = city if city and _real_place(city) else next((p for p in reversed(parts) if _real_place(p) and p.lower() not in STATES), "")
    country = "India" if india else next((p for p in parts if _real_place(p)), "")
    return ", ".join(x for x in dict.fromkeys((town, state, country)) if x), ("IN" if india else "")


async def fetch(http: Fetcher, company: Company) -> list[RawJob]:
    host = company.token.strip().strip("/")
    api = f"https://{host}/api/cp/rest/altone/cp/jobs/v1"
    jobs: list[RawJob] = []
    offset = 0
    while offset < MAX_JOBS:
        d = await http.post_json(f"{api}?offset={offset}&limit={PAGE}", {})
        rows = (d or {}).get("response") or []
        for j in rows:
            url = j.get("jobDetailUrl") or ""
            if not url:
                continue
            city = (j.get("locationHierarchy") or "").strip()
            path = j.get("locationHierarchyComplete") or ""
            if ">" in city:  # some portals put the whole path in the city field
                path, city = path or city, ""
            where, cc = _place(path, city)
            skills = (j.get("skills") or {})
            listed = [s.strip() for s in (skills.get("mustTohave") or []) + (skills.get("goodtohave") or []) if s and s.strip()]
            summary = " · ".join(x for x in (j.get("designation"), f"Experience: {j['expRange']}" if j.get("expRange") else "",
                                              f"Skills: {', '.join(listed)}" if listed else "") if x)
            jobs.append(
                RawJob(
                    external_id=j.get("jobCode") or url,
                    title=(j.get("jobTitle") or "").strip(),
                    job_url=url,
                    apply_url=url,
                    location_text=where,
                    country_hint=cc or None,
                    city_hint=where.split(",")[0] or None,
                    posted_at=parse_time(j.get("jobPostedDate")),
                    description=summary,
                    department=j.get("organizationUnit") or "",
                )
            )
        # Pages can come back shorter than asked (the API caps them), so page by what arrived until the total is reached.
        offset += len(rows)
        if not rows or offset >= (d or {}).get("totalRecords", 0):
            break
    return jobs
