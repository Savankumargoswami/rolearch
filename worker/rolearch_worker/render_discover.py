"""Second discovery pass for careers pages that build their job links with JavaScript.

Loads each company's careers pages in headless Chromium (Playwright), records every URL the page
requests or links to, and runs the same job-system detection on all of it. A board is kept only if its
public feed returns jobs (autodiscover._count). Needs `pip install playwright` and
`python -m playwright install chromium`; used for discovery only, not by the regular job refresh.
"""

from __future__ import annotations

import asyncio
import re
from urllib.parse import urlsplit

from .autodiscover import PREFERRED, Board, _count
from .http import Fetcher
from .identify import match

PAGES = ["https://careers.{d}", "https://www.{d}/careers", "https://jobs.{d}", "https://www.{d}/careers/search", "https://www.{d}/en/careers"]


async def _render(browser, url: str) -> tuple[str, str, list[str]]:
    """(final url, html, every requested/linked url) for one page; empty on failure."""
    page = await browser.new_page()
    seen: list[str] = []
    page.on("request", lambda req: seen.append(req.url))
    page.on("framenavigated", lambda frame: seen.append(frame.url))
    try:
        await page.goto(url, wait_until="domcontentloaded", timeout=25_000)
        await page.wait_for_timeout(4_000)
        html = await page.content()
        links = await page.eval_on_selector_all("a[href], iframe[src]", "els => els.map(e => e.href || e.src)")
        return page.url, html, seen + links
    except Exception:
        return "", "", seen
    finally:
        await page.close()


async def discover(browser, http: Fetcher, domain: str) -> Board | None:
    candidates: list[tuple[str, str]] = []
    for tpl in PAGES:
        final, html, urls = await _render(browser, tpl.format(d=domain))
        if not final:
            continue
        blob = " ".join([final, html, *urls])
        for f in match(blob):
            if f.ats in ("workday", "oracle", "greenhouse", "lever", "ashby", "smartrecruiters"):
                candidates.append((f.ats, f.token))
            elif f.ats == "eightfold":
                candidates.append(("eightfold", f"{f.token}.eightfold.ai|{domain}"))
        host = urlsplit(final).netloc
        ref = re.search(r'"refNum"\s*:\s*"([^"]+)"', html)
        if ref:
            loc = re.search(r'"locale"\s*:\s*"([^"]+)"', html)
            candidates.append(("phenom", f"{host}|{ref.group(1)}|{loc.group(1) if loc else 'en_us'}"))
        if any("/api/jobs" in u for u in urls):
            candidates.append(("jibe", host))
        site = re.search(r"/hcmUI/CandidateExperience/[a-z-]+/sites/([A-Za-z0-9_]+)", blob)
        if site and "oraclecloud" not in final:
            candidates.append(("oracle", f"{host}||{site.group(1)}"))
        if "jobTitle-link" in html:
            candidates.append(("successfactors-host", host))
        if candidates:
            break
    for ats, token in sorted(dict.fromkeys(candidates), key=lambda c: PREFERRED.index(c[0]) if c[0] in PREFERRED else 99):
        n = await _count(http, ats, token)
        if n > 0:
            return Board("successfactors" if ats == "successfactors-host" else ats, token, n)
    return None


async def discover_all(rows: list[tuple[str, str, str]], concurrency: int = 4) -> list[tuple[str, str, Board | None]]:
    from playwright.async_api import async_playwright

    sem = asyncio.Semaphore(concurrency)
    async with async_playwright() as pw, Fetcher() as http:
        browser = await pw.chromium.launch()
        try:

            async def one(row):
                name, country, domain = row
                async with sem:
                    try:
                        board = await asyncio.wait_for(discover(browser, http, domain), timeout=180)
                    except Exception:
                        board = None
                print(f"{'FOUND' if board else 'none '} {name}: {board}", flush=True)
                return name, country, board

            return await asyncio.gather(*(one(r) for r in rows))
        finally:
            await browser.close()
