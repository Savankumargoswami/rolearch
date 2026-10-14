"""One fetcher per applicant tracking system. Each returns RawJobs for one company.

All of these are the public, keyless job-board feeds the ATS vendors publish for
career sites and job aggregators. Nothing here logs in or submits applications.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from ..http import Fetcher
from ..models import Company, RawJob
from . import ashby, greenhouse, jsonld, lever, personio, recruitee, smartrecruiters, workable

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
}

# Order used by `discover` to guess which ATS a company slug lives on.
PROBE_ORDER = ["greenhouse", "lever", "ashby", "workable", "recruitee", "smartrecruiters", "personio", "lever-eu"]
