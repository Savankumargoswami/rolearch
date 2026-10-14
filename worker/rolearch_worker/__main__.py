"""Rolearch job-feed worker.

  python -m rolearch_worker discover          # find each candidate company's ATS board -> companies.csv
  python -m rolearch_worker run               # pull all boards, store, close vanished jobs, write the site feed
  python -m rolearch_worker run --only stripe # one company (name or token contains "stripe")
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys
import time
from pathlib import Path

from . import companies as company_file
from .run import discover, export_feed, pull_all
from .store import JsonStore, open_store

HERE = Path(__file__).resolve().parent.parent
DEFAULTS = {
    "candidates": HERE / "companies" / "candidates.csv",
    "companies": HERE / "companies" / "companies.csv",
    "state": HERE / "state" / "jobs.json",
    "feed": HERE.parent / "src" / "data" / "feed.json",
}


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(prog="rolearch_worker")
    sub = p.add_subparsers(dest="cmd", required=True)

    d = sub.add_parser("discover", help="find which ATS each candidate company uses")
    d.add_argument("--candidates", type=Path, default=DEFAULTS["candidates"])
    d.add_argument("--out", type=Path, default=DEFAULTS["companies"])

    r = sub.add_parser("run", help="pull jobs from every company in companies.csv")
    r.add_argument("--companies", type=Path, default=DEFAULTS["companies"])
    r.add_argument("--state", type=Path, default=DEFAULTS["state"], help="JSON state file (when DATABASE_URL is unset)")
    r.add_argument("--feed", type=Path, default=DEFAULTS["feed"], help="site feed file; '-' to skip")
    r.add_argument("--feed-limit", type=int, default=1500)
    r.add_argument("--only", help="run companies whose name or token contains this text")
    r.add_argument("--concurrency", type=int, default=8)

    for s in (d, r):
        s.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.cmd == "discover":
        candidates = company_file.load_candidates(args.candidates)
        existing = {c.name.lower(): c for c in company_file.load(args.out)} if args.out.exists() else {}
        todo = [c for c in candidates if c[0].lower() not in existing]
        found, missing = asyncio.run(discover(todo))
        company_file.save(args.out, [*existing.values(), *found])
        print(f"\n{len(found)} new boards found, {len(missing)} not found, {len(existing) + len(found)} companies in {args.out.name}")
        if missing:
            print("Not found (add the right slug or a careers_url):", ", ".join(sorted(missing)))
        return 0

    companies = company_file.load(args.companies)
    if args.only:
        needle = args.only.lower()
        companies = [c for c in companies if needle in c.name.lower() or needle in c.token.lower()]
    if not companies:
        print("No companies to run.", file=sys.stderr)
        return 1

    store = open_store(args.state)
    started = time.monotonic()
    try:
        results = asyncio.run(pull_all(companies, store, args.concurrency))
        # Only the full, default list is authoritative; a subset run must not close other companies' jobs.
        full_run = not args.only and args.companies == DEFAULTS["companies"]
        retired = store.retire_companies({c.key for c in companies}) if full_run else 0
        feed_count = None
        if str(args.feed) != "-" and isinstance(store, JsonStore):
            feed_count = export_feed(store, args.feed, args.feed_limit)
    finally:
        store.close()

    ok = [r for r in results if not r.error]
    errors = [r for r in results if r.error]
    print(
        f"\n{len(ok)}/{len(results)} boards ok in {time.monotonic() - started:.0f}s · "
        f"{sum(r.total for r in ok)} jobs ({sum(r.launch for r in ok)} data/ML) · "
        f"+{sum(r.added for r in ok)} new · {sum(r.closed for r in ok)} closed"
        + (f" · {feed_count} written to {args.feed}" if feed_count is not None else "")
        + (f" · {retired} jobs closed from companies removed from the list" if retired else "")
        + (" · stored in Postgres" if os.environ.get("DATABASE_URL") else "")
    )
    for r in errors:
        print(f"  ! {r.company.name} ({r.company.ats}:{r.company.token}): {r.error}")
    return 0 if len(errors) < len(results) else 2


if __name__ == "__main__":
    raise SystemExit(main())
