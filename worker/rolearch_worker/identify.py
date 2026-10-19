"""Work out which job system a company uses by reading its own careers page.

Careers pages link to (or embed) the system that actually holds the jobs: Workday, iCIMS, Oracle
Recruiting Cloud, SuccessFactors, Eightfold, Taleo, Greenhouse, Lever and so on. Following the page
(and one level of "search jobs" links) and matching those URLs gives the exact board, instead of
guessing slugs from the company name.
"""

from __future__ import annotations

import asyncio
import re
from dataclasses import dataclass
from urllib.parse import urljoin

from .http import Fetcher

# (system, pattern); the groups make up the board's token.
SIGNATURES: list[tuple[str, re.Pattern[str]]] = [
    ("workday", re.compile(r"https?://([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([A-Za-z0-9_-]+)", re.I)),
    ("workday", re.compile(r"https?://(wd\d+)\.myworkdaysite\.com/(?:[a-z]{2}-[A-Z]{2}/)?recruiting/([a-z0-9-]+)/([A-Za-z0-9_-]+)", re.I)),
    ("greenhouse", re.compile(r"(?:boards|job-boards)(?:\.eu)?\.greenhouse\.io/(?:embed/job_board(?:/js)?\?for=)?([A-Za-z0-9_-]+)", re.I)),
    ("lever", re.compile(r"jobs\.lever\.co/([A-Za-z0-9_-]+)", re.I)),
    ("ashby", re.compile(r"jobs\.ashbyhq\.com/([A-Za-z0-9_.-]+)", re.I)),
    ("smartrecruiters", re.compile(r"(?:jobs|careers)\.smartrecruiters\.com/([A-Za-z0-9_-]+)", re.I)),
    ("icims", re.compile(r"https?://((?:[a-z0-9-]+\.)?[a-z0-9-]+)\.icims\.com", re.I)),
    ("oracle", re.compile(r"https?://([a-z0-9-]+)\.fa\.(?:([a-z0-9-]+)\.)?oraclecloud\.com/hcmUI/CandidateExperience/[a-z-]+/sites/([A-Za-z0-9_]+)", re.I)),
    ("successfactors", re.compile(r"https?://(career\d*)\.(?:sapsf|successfactors)\.(?:com|eu|cn)/(?:career|portalcareer)[^\"'\s]*?company=([A-Za-z0-9_]+)", re.I)),
    ("eightfold", re.compile(r"https?://([a-z0-9-]+)\.eightfold\.ai", re.I)),
    ("taleo", re.compile(r"https?://([a-z0-9-]+)\.taleo\.net", re.I)),
    ("jobvite", re.compile(r"jobs\.jobvite\.com/([A-Za-z0-9_-]+)", re.I)),
    ("workable", re.compile(r"apply\.workable\.com/([A-Za-z0-9_-]+)", re.I)),
    ("phenom", re.compile(r"cdn\.phenompeople\.com|phenompeople", re.I)),
]

_SKIP_TOKENS = {"embed", "jobs", "job", "careers", "api", "v1", "en-us", "search"}
_LINKS = re.compile(r"""href=["']([^"'#]+)["']""", re.I)
_JOBS_LINK = re.compile(r"(job|career|opening|position|search|vacanc|opportunit)", re.I)


@dataclass
class Found:
    ats: str
    token: str
    url: str


def match(html: str) -> list[Found]:
    out: list[Found] = []
    for ats, rx in SIGNATURES:
        for m in rx.finditer(html):
            groups = [g or "" for g in m.groups()] if m.groups() else []
            if ats == "workday" and groups and groups[0].lower().startswith("wd"):  # myworkdaysite.com form: wdN, tenant, site
                groups = [groups[1], groups[0], groups[2]]
            token = "|".join(groups) if ats in ("workday", "oracle") else (groups[0] if groups else "")
            if ats == "successfactors" and len(groups) == 2:
                token = f"{groups[0]}|{groups[1]}"
            if token.lower() in _SKIP_TOKENS:
                continue
            out.append(Found(ats, token, m.group(0)))
    return out


async def identify(http: Fetcher, careers_url: str) -> list[Found]:
    """The job systems a careers page points to, best guess first."""
    try:
        r = await http.get(careers_url, attempts=2)
    except Exception:
        return []
    if r.status_code >= 400:
        return []
    html = r.text
    found = match(str(r.url)) + match(html)
    if not any(f.ats != "phenom" for f in found):
        # One level deeper: the page's own "search jobs" links often lead to the real system.
        links = []
        for href in _LINKS.findall(html):
            if _JOBS_LINK.search(href):
                links.append(urljoin(str(r.url), href))
        for link in list(dict.fromkeys(links))[:6]:
            found += match(link)
            if any(f.ats != "phenom" for f in found):
                break
            try:
                r2 = await http.get(link, attempts=1)
                found += match(str(r2.url)) + match(r2.text)
            except Exception:
                continue
            if any(f.ats != "phenom" for f in found):
                break
    # Most-mentioned real system first; Phenom only matters if nothing else was found.
    counts: dict[tuple[str, str], int] = {}
    for f in found:
        counts[(f.ats, f.token)] = counts.get((f.ats, f.token), 0) + 1
    order = sorted(counts, key=lambda k: (k[0] == "phenom", -counts[k]))
    first = {k: next(f for f in found if (f.ats, f.token) == k) for k in order}
    return list(first.values())


async def identify_all(rows: list[tuple[str, str, str]], concurrency: int = 8) -> list[tuple[str, str, str, list[Found]]]:
    """rows: (name, country, careers_url) -> (name, country, careers_url, found)."""
    sem = asyncio.Semaphore(concurrency)
    async with Fetcher() as http:

        async def one(row):
            async with sem:
                return (*row, await identify(http, row[2]))

        return await asyncio.gather(*(one(r) for r in rows))
