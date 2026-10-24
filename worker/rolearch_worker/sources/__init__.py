"""One fetcher per applicant tracking system. Each returns RawJobs for one company.

All of these are the public, keyless job-board feeds the ATS vendors publish for
career sites and job aggregators. Nothing here logs in or submits applications.
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable

from ..http import Fetcher
from ..models import Company, RawJob
from . import adp, adzuna, amazon, apple, applitrack, ashby, avature, bamboohr, bestbuy, breezy, darwinbox, eightfold, feed, gem, keka, google, greenhouse, ibm, icims, jazzhr, jibe, jobvite, jsonld, lever, oracle, paylocity, peoplestrong, personio, phenom, recruitee, rippling, sitemap, smartrecruiters, successfactors, taleo, usajobs, virecruit, workable, workday, zohorecruit

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
    "eightfold": eightfold.fetch,
    "successfactors": successfactors.fetch,
    "jibe": jibe.fetch,
    "icims": icims.fetch,
    "phenom": phenom.fetch,
    "sitemap": sitemap.fetch,
    "amazon": amazon.fetch,
    "taleo": taleo.fetch,
    "ibm": ibm.fetch,
    "bestbuy": bestbuy.fetch,
    "google": google.fetch,
    "apple": apple.fetch,
    "avature": avature.fetch,
    "virecruit": virecruit.fetch,
    "rippling": rippling.fetch,
    "gem": gem.fetch,
    "bamboohr": bamboohr.fetch,
    "jazzhr": jazzhr.fetch,
    "breezy": breezy.fetch,
    "jobvite": jobvite.fetch,
    "applitrack": applitrack.fetch,
    "darwinbox": darwinbox.fetch,
    "keka": keka.fetch,
    "peoplestrong": peoplestrong.fetch,
    "zohorecruit": zohorecruit.fetch,
    "paylocity": paylocity.fetch,
    "adp": adp.fetch,
    # Feeds companies connect on Rolearch (db/023_employer_feeds.sql).
    "feed": feed.fetch,
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
