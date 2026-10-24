"""RawJob -> the job record Rolearch stores and shows."""

from __future__ import annotations

import hashlib
import re
import unicodedata
from datetime import datetime, timezone

from .geo import COUNTRIES, CITIES, city_coords, parse_location
from .categories import category_of
from .models import Company, RawJob
from .text import clean_title, extract_skills, in_launch_field, level_of, summarize, visa_offered, years_required

SOURCE_LABEL = {
    "greenhouse": "Greenhouse", "lever": "Lever", "lever-eu": "Lever", "ashby": "Ashby", "workable": "Workable",
    "smartrecruiters": "SmartRecruiters", "recruitee": "Recruitee", "personio": "Personio", "jsonld": "Careers page", "usajobs": "USAJOBS", "adzuna": "Adzuna", "workday": "Workday", "oracle": "Oracle", "eightfold": "Eightfold", "successfactors": "SuccessFactors", "jibe": "iCIMS", "icims": "iCIMS", "phenom": "Phenom", "sitemap": "Careers page", "amazon": "Amazon", "taleo": "Taleo", "ibm": "IBM", "bestbuy": "Best Buy", "google": "Google", "apple": "Apple", "avature": "Avature", "virecruit": "viRecruit", "rippling": "Rippling", "gem": "Gem", "bamboohr": "BambooHR", "jazzhr": "JazzHR", "breezy": "Breezy HR", "jobvite": "Jobvite", "applitrack": "AppliTrack", "darwinbox": "Darwinbox", "keka": "Keka", "peoplestrong": "PeopleStrong", "zohorecruit": "Zoho Recruit", "paylocity": "Paylocity", "adp": "ADP", "feed": "Employer feed",
}


def slug(s: str, n: int = 40) -> str:
    s = unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()
    s = re.sub(r"[^a-zA-Z0-9]+", "-", s).strip("-").lower()
    return s[:n].rstrip("-") or "job"


def job_id(company: Company, raw: RawJob) -> str:
    """Stable and readable: same posting -> same id on every run."""
    h = hashlib.sha1(f"{company.key}:{raw.external_id}".encode()).hexdigest()[:8]
    return f"{slug(raw.company_name or company.name, 24)}-{slug(raw.title, 48)}-{h}"


def dedupe_key(company: Company, title: str, place: str) -> str:
    return hashlib.sha1(f"{company.name.lower()}|{title.lower()}|{place.lower()}".encode()).hexdigest()


# "Remote" / "Hybrid" as a way of working, not as part of the job itself (remote sensing, hybrid cloud).
_REMOTE_TITLE = re.compile(r"\bremote\b(?!\s*(sensing|monitoring|pilot|patient|vehicle|systems?|operations? center|site))", re.I)
_HYBRID_TITLE = re.compile(r"\bhybrid\b(?!\s*(cloud|vehicles?|electric|powertrain|it|infrastructure|integration|systems?))", re.I)


def workplace_from_title(title: str) -> str | None:
    if _HYBRID_TITLE.search(title or ""):
        return "hybrid"
    if _REMOTE_TITLE.search(title or ""):
        return "remote"
    return None


def normalize(company: Company, raw: RawJob, now: datetime | None = None) -> dict | None:
    if not raw.title or not raw.job_url:
        return None
    employer = raw.company_name or company.name
    title = clean_title(raw.title, employer)
    now = now or datetime.now(timezone.utc)
    place = parse_location(raw.location_text, default_country=company.country)
    country = raw.country_hint if raw.country_hint in COUNTRIES else place.country
    city = raw.city_hint or place.city
    lat, lon = place.lat, place.lon
    if city and (lat is None) and city.lower() in CITIES and CITIES[city.lower()][0] == country:
        _, lat, lon = CITIES[city.lower()]
    if city and lat is None:
        found = city_coords(city, country, raw.location_text or "")
        if found:
            lat, lon = found

    workplace = raw.workplace_hint or ("remote" if place.remote else "onsite")
    # Many boards leave the flag empty (or say on-site) while the title says "(Remote)" or "Hybrid".
    if workplace == "onsite":
        workplace = workplace_from_title(raw.title) or workplace
    remote = workplace == "remote"
    country_name = COUNTRIES[country][0] if country in COUNTRIES else None
    region = COUNTRIES[country][1] if country in COUNTRIES else "global"
    if remote:
        display_city, display_country = "Remote", country_name or "Worldwide"
        if not country_name:
            region = "global"
    else:
        display_city = (city or country_name or "").strip()
        display_country = country_name or ""
        # Some feeds shout ("AUSTIN"); show place names in normal case.
        if display_city.isupper() and len(display_city) > 3:
            display_city = display_city.title()

    text = f"{title}\n{raw.description}"
    posted = raw.posted_at or now
    days = max(0, (now - posted).days)
    salary = raw.salary
    return {
        "id": job_id(company, raw),
        "dedupeKey": dedupe_key(Company(employer, company.country, company.ats, company.token), title, f"{display_city}|{display_country}"),
        "companyKey": company.key,
        "title": title,
        "company": employer,
        "city": display_city,
        "country": display_country,
        "countryCode": country,
        "region": region,
        "workplace": workplace,
        "visa": visa_offered(raw.description),
        "salary": (
            {"min": round(salary.min), "max": round(salary.max), "currency": salary.currency.upper(), "period": salary.period}
            if salary and salary.min and salary.max and salary.max >= salary.min
            else None
        ),
        "level": level_of(title),
        "years": years_required(raw.description),
        "skills": extract_skills(text),
        "nice": [],
        "postedAt": posted.isoformat(),
        "postedDaysAgo": days,
        "source": SOURCE_LABEL.get(company.ats, company.ats),
        "summary": summarize(raw.description),
        # Full text for matching and the ATS check.
        "description": (raw.description or "")[:20000],
        "category": "data" if in_launch_field(title) else category_of(title, raw.category_hint),
        "verified": company.ats not in ("usajobs", "adzuna"),
        "touchOnly": raw.touch_only,
        "duties": [],
        "jobUrl": raw.job_url,
        "applyUrl": raw.apply_url or raw.job_url,
        "department": raw.department,
        "lat": lat,
        "lon": lon,
        "launchField": in_launch_field(title),
    }
