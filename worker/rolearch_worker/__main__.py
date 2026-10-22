"""Rolearch job-feed worker.

  python -m rolearch_worker discover          # find each candidate company's ATS board -> companies.csv
  python -m rolearch_worker run               # pull all boards, store, close vanished jobs, write the site feed
  python -m rolearch_worker run --only stripe # one company (name or token contains "stripe")
"""

from __future__ import annotations

import argparse
import hashlib
import asyncio
import logging
import os
import sys
import time
from datetime import datetime, timedelta, timezone
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

    h = sub.add_parser("harvest", help="add employers that are hiring (from Adzuna) to candidates.csv, for discover")
    h.add_argument("--candidates", type=Path, default=DEFAULTS["candidates"])
    h.add_argument("--companies", type=Path, default=DEFAULTS["companies"])
    h.add_argument("--countries", default="us,gb,ca,in,au")
    h.add_argument("--calls", type=int, default=12, help="Adzuna calls per country (free plan: a few thousand a month)")
    h.add_argument("--limit", type=int, default=300, help="most new candidates to add")

    r = sub.add_parser("run", help="pull jobs from every company in companies.csv")
    r.add_argument("--companies", type=Path, default=DEFAULTS["companies"])
    r.add_argument("--state", type=Path, default=DEFAULTS["state"], help="JSON state file (when DATABASE_URL is unset)")
    r.add_argument("--feed", type=Path, default=DEFAULTS["feed"], help="site feed file; '-' to skip")
    r.add_argument("--feed-limit", type=int, default=1500)
    r.add_argument("--only", help="run companies whose name or token contains this text")
    r.add_argument("--concurrency", type=int, default=8)
    r.add_argument("--shard", help='run one slice of the list, "i/n" (e.g. "0/8"); slices are stable as the list grows')

    f = sub.add_parser("finalize", help="after sharded runs: close jobs of companies no longer listed, refresh site totals")
    f.add_argument("--companies", type=Path, default=DEFAULTS["companies"])
    f.add_argument("--state", type=Path, default=DEFAULTS["state"])
    f.add_argument("--grace-hours", type=float, default=12, help="keep companies refreshed this recently even if unlisted")

    for s in (d, h, r, f):
        s.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO, format="%(message)s")
    logging.getLogger("httpx").setLevel(logging.WARNING)

    if args.cmd == "harvest":
        from .harvest import add_candidates, adzuna_employers

        found = asyncio.run(adzuna_employers([c.strip() for c in args.countries.split(",") if c.strip()], args.calls))
        existing = {c.name.lower() for c in company_file.load(args.companies)}
        n = add_candidates(args.candidates, found, existing, args.limit)
        print(f"{len(found)} employers seen on Adzuna · {n} new candidates added to {args.candidates.name}. Next: python -m rolearch_worker discover")
        return 0

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

    if args.cmd == "finalize":
        store = open_store(args.state)
        try:
            listed = {c.key for c in company_file.load(args.companies)}
            since = datetime.now(timezone.utc) - timedelta(hours=args.grace_hours)
            retired = store.retire_companies(listed, since)
            if hasattr(store, "refresh_summary"):
                store.refresh_summary()
        finally:
            store.close()
        print(f"{len(listed)} companies listed · {retired} jobs closed from companies no longer listed · site totals refreshed")
        return 0

    companies = company_file.load(args.companies)
    if getattr(args, "shard", None):
        i, n = (int(x) for x in args.shard.split("/"))
        # Stable slices: a company stays in the same shard when others are added or removed.
        companies = [c for c in companies if int(hashlib.sha1(c.key.encode()).hexdigest(), 16) % n == i]
    if args.only:
        needle = args.only.lower()
        companies = [c for c in companies if needle in c.name.lower() or needle in c.token.lower()]
    if not companies:
        print("No companies to run.", file=sys.stderr)
        return 1

    store = open_store(args.state)
    started = time.monotonic()
    run_start = datetime.now(timezone.utc)
    try:
        results = asyncio.run(pull_all(companies, store, args.concurrency))
        # Only the full, default list is authoritative; a subset run must not close other companies' jobs.
        full_run = not args.only and not getattr(args, "shard", None) and args.companies == DEFAULTS["companies"]
        # Companies whose jobs another run stored after this one began (e.g. a list updated mid-run) stay open.
        retired = store.retire_companies({c.key for c in companies}, run_start) if full_run else 0
        if hasattr(store, "refresh_summary"):
            store.refresh_summary()
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
