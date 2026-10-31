from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class Company:
    name: str
    country: str  # ISO2 of HQ, used when a job's location has no country
    ats: str  # greenhouse | lever | lever-eu | ashby | workable | smartrecruiters | recruitee | personio | jsonld
    token: str  # board token / site name / account id; for jsonld, unused
    careers_url: str = ""
    domain: str = ""  # the employer's website, for its logo on the site
    described: set[str] | None = field(default=None, compare=False, repr=False)  # ids with a stored description
    known_urls: dict[str, str] | None = field(default=None, compare=False, repr=False)  # job URL -> stored title
    partial: bool = field(default=False, compare=False, repr=False)  # set by a source that read only part of the board

    @property
    def key(self) -> str:
        return f"{self.ats}:{self.token}".lower()


@dataclass
class Salary:
    min: float
    max: float
    currency: str
    period: str  # year | month | hour


@dataclass
class RawJob:
    """What a source hands back, before normalization."""

    external_id: str
    title: str
    job_url: str  # the job's page on the company's careers site / ATS board
    apply_url: str  # where "Apply" goes; usually the same page or its /apply form
    location_text: str = ""
    country_hint: str | None = None  # ISO2 when the ATS gives one
    city_hint: str | None = None
    workplace_hint: str | None = None  # remote | hybrid | onsite
    posted_at: datetime | None = None
    description: str = ""  # plain text
    salary: Salary | None = None
    department: str = ""
    extra_locations: list[str] = field(default_factory=list)
    company_name: str | None = None  # set by aggregator sources, where one feed carries many employers
    category_hint: str | None = None  # the source's own category label, if it has one
    touch_only: bool = False  # already stored with full details: just mark it as still open
