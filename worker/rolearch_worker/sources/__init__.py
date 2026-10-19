"""One fetcher per applicant tracking system. Each returns RawJobs for one company.

All of these are the public, keyless job-board feeds the ATS vendors publish for
career sites and job aggregators. Nothing here logs in or submits applications.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from ..http import Fetcher
from ..models import Company, RawJob
from . import adzuna, ashby, greenhouse, jsonld, lever, oracle, personio, recruitee, smartrecruiters, usajobs, workable, workday

Source = Callable[[Fetcher, Company], Awaitable[list[RawJob]]]

SOURCES: dict[str, Source] = {
    "greenhouse": greenhouse.fetch,
    "lever": lever.fetch,
    "lever-eu": lever.fetch_eu,
    "ashby": ashby.fetch,
    "workable": workable.fetch,
    "smartrecruiters": smartrecruiters.fetch,
    "recruitee": recruitee.fetch,
    "personio": personio.fetch,
    "jsonld": jsonld.fetch,
    "workday": workday.fetch,
    "oracle": oracle.fetch,
    # Aggregators: one "company" row per feed; each job carries its real employer's name.
    "usajobs": usajobs.fetch,
    "adzuna": adzuna.fetch,
}

# Feeds that hand back a different slice each run: keep their jobs until they age out instead of
# closing everything a run didn't fetch, and don't call them more than once a day.
AGGREGATORS = {"adzuna"}
VERIFIED_SOURCES = set(SOURCES) - {"usajobs", "adzuna"}

# Order used by `discover` to guess which ATS a company slug lives on.
PROBE_ORDER = ["greenhouse", "lever", "ashby", "workable", "recruitee", "smartrecruiters", "personio", "lever-eu"]
