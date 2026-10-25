"""Where jobs go: a JSON state file (no setup) or Postgres/Supabase (DATABASE_URL)."""

from __future__ import annotations

import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .sources import AGGREGATORS
from .models import Company

log = logging.getLogger(__name__)

DROP_GUARD = 20  # a board that had this many open jobs and suddenly returns 0 is treated as a feed failure


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store(Protocol):
    def previous_count(self, company: Company) -> int: ...
    def hours_since_ok(self, company: Company) -> float | None: ...
    def described_ids(self, company: Company) -> set[str]: ...
    def known_urls(self, company: Company) -> dict[str, str]: ...
    def known_ids(self, company: Company) -> set[str]: ...
    def save(self, company: Company, jobs: list[dict]) -> tuple[int, int, int]: ...
    def record_error(self, company: Company, error: str) -> None: ...
    def retire_companies(self, keep: set[str], since: datetime | None = None) -> int: ...
    def open_jobs(self, launch_only: bool, limit: int) -> list[dict]: ...
    def close(self) -> None: ...


class JsonStore:
    """Keeps every job ever seen with first/last-seen times and open/closed status."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.data = json.loads(path.read_text("utf-8")) if path.exists() else {"companies": {}, "jobs": {}}

    def hours_since_ok(self, company: Company) -> float | None:
        return None  # the JSON store keeps no run history; aggregators run every time

    def described_ids(self, company: Company) -> set[str]:
        return {jid for jid, j in self.data["jobs"].items() if j["companyKey"] == company.key and j.get("description")}

    def known_urls(self, company: Company) -> dict[str, str]:
        return {j["jobUrl"]: j["title"] for j in self.data["jobs"].values() if j["companyKey"] == company.key}

    def previous_count(self, company: Company) -> int:
        return sum(1 for j in self.data["jobs"].values() if j["companyKey"] == company.key and j["status"] == "open")

    def known_ids(self, company: Company) -> set[str]:
        return {jid for jid, j in self.data["jobs"].items() if j["companyKey"] == company.key}

    def save(self, company: Company, jobs: list[dict]) -> tuple[int, int, int]:
        now = _now()
        seen = {j["id"] for j in jobs}
        added = updated = closed = 0
        for job in jobs:
            old = self.data["jobs"].get(job["id"])
            if old:
                updated += 1
            else:
                added += 1
            self.data["jobs"][job["id"]] = {
                **job,
                "firstSeenAt": old["firstSeenAt"] if old else now,
                "lastSeenAt": now,
                "status": "open",
                "closedAt": None,
            }
        for jid, job in self.data["jobs"].items():
            if job["companyKey"] == company.key and job["status"] == "open" and jid not in seen:
                job["status"], job["closedAt"] = "closed", now
                closed += 1
        self.data["companies"][company.key] = {
            "name": company.name, "lastRunAt": now, "lastOkAt": now, "lastJobCount": len(jobs), "lastError": None,
        }
        return added, updated, closed

    def record_error(self, company: Company, error: str) -> None:
        entry = self.data["companies"].setdefault(company.key, {"name": company.name})
        entry.update({"lastRunAt": _now(), "lastError": error[:500]})

    def retire_companies(self, keep: set[str], since: datetime | None = None) -> int:
        """Close open jobs of companies no longer in companies.csv."""
        now, n = _now(), 0
        for job in self.data["jobs"].values():
            if job["status"] == "open" and job["companyKey"] not in keep:
                job["status"], job["closedAt"] = "closed", now
                n += 1
        return n

    def open_jobs(self, launch_only: bool, limit: int) -> list[dict]:
        jobs = [j for j in self.data["jobs"].values() if j["status"] == "open" and (j["launchField"] or not launch_only)]
        jobs.sort(key=lambda j: j["postedAt"], reverse=True)
        return jobs[:limit]

    def close(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(self.data, ensure_ascii=False), "utf-8")
        tmp.replace(self.path)


class PostgresStore:
    """Upserts into the tables in db/schema.sql. Use the service-role connection string."""

    COLS = (
        "id company_key dedupe_key title company city country country_code region workplace visa salary_min salary_max "
        "salary_currency salary_period level years skills summary department job_url apply_url source launch_field lat lon posted_at description category verified"
    ).split()

    def __init__(self, dsn: str) -> None:
        import psycopg

        self.conn = psycopg.connect(dsn, autocommit=False)

    def known_urls(self, company: Company) -> dict[str, str]:
        with self.conn.cursor() as cur:
            cur.execute("select job_url, title from jobs where company_key = %s", (company.key,))
            return {r[0]: r[1] for r in cur.fetchall()}

    def described_ids(self, company: Company) -> set[str]:
        with self.conn.cursor() as cur:
            cur.execute("select id from jobs where company_key = %s and description <> ''", (company.key,))
            return {r[0] for r in cur.fetchall()}

    def hours_since_ok(self, company: Company) -> float | None:
        with self.conn.cursor() as cur:
            cur.execute("select extract(epoch from now() - last_ok_at) / 3600 from companies where key = %s", (company.key,))
            row = cur.fetchone()
            return float(row[0]) if row and row[0] is not None else None

    def previous_count(self, company: Company) -> int:
        with self.conn.cursor() as cur:
            cur.execute("select count(*) from jobs where company_key = %s and status = 'open'", (company.key,))
            return cur.fetchone()[0]

    def known_ids(self, company: Company) -> set[str]:
        with self.conn.cursor() as cur:
            cur.execute("select id from jobs where company_key = %s", (company.key,))
            return {r[0] for r in cur.fetchall()}

    def _company(self, cur, company: Company, count: int | None, error: str | None) -> None:
        cur.execute(
            """insert into companies (key, name, country, ats, token, careers_url, last_run_at, last_ok_at, last_job_count, last_error)
               values (%s, %s, %s, %s, %s, %s, now(), case when %s::text is null then now() end, %s::integer, %s::text)
               on conflict (key) do update set name = excluded.name, country = excluded.country, careers_url = excluded.careers_url,
                 last_run_at = now(),
                 last_ok_at = coalesce(excluded.last_ok_at, companies.last_ok_at),
                 last_job_count = coalesce(excluded.last_job_count, companies.last_job_count),
                 last_error = excluded.last_error""",
            (company.key, company.name, company.country, company.ats, company.token, company.careers_url, error, count, error),
        )

    def save(self, company: Company, jobs: list[dict]) -> tuple[int, int, int]:
        touch = [j["id"] for j in jobs if j.get("touchOnly")]
        all_ids = [j["id"] for j in jobs]
        jobs = [j for j in jobs if not j.get("touchOnly")]
        rows = [
            (
                j["id"], company.key, j["dedupeKey"], j["title"], j["company"], j["city"], j["country"], j["countryCode"],
                j["region"], j["workplace"], j["visa"],
                (j["salary"] or {}).get("min"), (j["salary"] or {}).get("max"), (j["salary"] or {}).get("currency"),
                (j["salary"] or {}).get("period"), j["level"], j["years"], j["skills"], j["summary"], j["department"],
                j["jobUrl"], j["applyUrl"], j["source"], j["launchField"], j["lat"], j["lon"], j["postedAt"], j.get("description", ""), j.get("category", "other"), j.get("verified", True),
            )
            for j in jobs
        ]
        cols = ", ".join(self.COLS)
        marks = ", ".join(["%s"] * len(self.COLS))
        updates = ", ".join(f"{c} = excluded.{c}" for c in self.COLS if c != "id")
        try:
            with self.conn.cursor() as cur:
                self._company(cur, company, len(jobs), None)
                cur.execute("select id from jobs where company_key = %s", (company.key,))
                known = {r[0] for r in cur.fetchall()}
                if rows:
                    cur.executemany(
                        f"""insert into jobs ({cols}) values ({marks})
                            on conflict (id) do update set {updates}, last_seen_at = now(), status = 'open', closed_at = null""",
                        rows,
                    )
                if touch:
                    cur.execute(
                        "update jobs set last_seen_at = now(), status = 'open', closed_at = null where company_key = %s and id = any(%s)",
                        (company.key, touch),
                    )
                if company.domain:
                    # The employer's website, for its logo; one cheap update per company covers touched jobs too.
                    cur.execute(
                        "update jobs set company_domain = %s where company_key = %s and company_domain is distinct from %s",
                        (company.domain, company.key, company.domain),
                    )
                if company.ats in AGGREGATORS:
                    # Each run fetches a different slice: close by age, not by absence.
                    cur.execute(
                        """update jobs set status = 'closed', closed_at = now(), description = ''
                           where company_key = %s and status = 'open' and coalesce(posted_at, first_seen_at) < now() - interval '30 days'""",
                        (company.key,),
                    )
                else:
                    cur.execute(
                        """update jobs set status = 'closed', closed_at = now(), description = ''
                           where company_key = %s and status = 'open' and not (id = any(%s))""",
                        (company.key, all_ids),
                    )
                closed = cur.rowcount
            self.conn.commit()
        except Exception:
            self.conn.rollback()  # leave the connection usable for the next company
            raise
        added = sum(1 for j in jobs if j["id"] not in known)
        return added, len(jobs) + len(touch) - added, closed

    def record_error(self, company: Company, error: str) -> None:
        try:
            with self.conn.cursor() as cur:
                self._company(cur, company, None, error[:500])
            self.conn.commit()
        except Exception:
            self.conn.rollback()
            raise

    def retire_companies(self, keep: set[str], since: datetime | None = None) -> int:
        with self.conn.cursor() as cur:
            if since:
                # A company another run refreshed after `since` is on a newer list than ours: leave it alone.
                cur.execute("select distinct company_key from jobs where last_seen_at >= %s", (since,))
                keep = keep | {r[0] for r in cur.fetchall()}
            # Jobs companies post on Rolearch itself ("rolearch:<account>") and jobs from feeds they connected
            # ("feed:<id>") aren't on the list; their companies close them (removing a feed closes its jobs).
            cur.execute(
                "update jobs set status = 'closed', closed_at = now(), description = '' "
                "where status = 'open' and not (company_key = any(%s)) and company_key not like 'rolearch:%%' and company_key not like 'feed:%%'",
                (list(keep),),
            )
            n = cur.rowcount
            cur.execute("update companies set active = (key = any(%s)) where key not like 'rolearch:%%' and key not like 'feed:%%'", (list(keep),))
        self.conn.commit()
        return n

    def employer_feeds(self) -> list[Company]:
        """Feeds companies connected on Rolearch (db/023), as companies to read, named after the account."""
        try:
            with self.conn.cursor() as cur:
                cur.execute(
                    "select f.id::text, f.url, coalesce(nullif(p.company_name, ''), 'Company'), coalesce(p.website, '') "
                    "from public.employer_feeds f join public.profiles p on p.id = f.owner "
                    "where p.account_type = 'company' and p.company_domain_matches"
                )
                rows = cur.fetchall()
        except Exception as e:  # an older database without employer feeds
            self.conn.rollback()
            log.warning("employer feeds not read: %s", e)
            return []
        domain = lambda site: re.sub(r"^(https?://)?(www\.)?", "", site.strip().lower()).split("/")[0]  # noqa: E731
        return [Company(name=name, country="US", ats="feed", token=fid, careers_url=url, domain=domain(site)) for fid, url, name, site in rows]

    def record_feed(self, company: Company, total: int, error: str) -> None:
        """What the last read of a connected feed found, for the company's dashboard."""
        with self.conn.cursor() as cur:
            cur.execute(
                "update public.employer_feeds set status = %s, job_count = %s, last_error = %s, last_checked_at = now() where id = %s::uuid",
                ("error" if error else "ok", None if error else total, error[:300] or None, company.token),
            )
        self.conn.commit()

    def open_jobs(self, launch_only: bool, limit: int) -> list[dict]:
        raise NotImplementedError("With a database, the website reads jobs from Supabase directly.")

    def refresh_summary(self) -> None:
        """Recompute the site's totals, category counts and map pins (db/013_fast_search.sql)."""
        try:
            with self.conn.cursor() as cur:
                # With 1.5M open jobs the totals take over 3 minutes; the database's default 2-minute limit cut it off.
                cur.execute("set statement_timeout = '15min'")
                cur.execute("select public.refresh_job_summary_and_vocab()")
            self.conn.commit()
        except Exception as e:  # an older database without the summary: the site still works, just slower
            self.conn.rollback()
            log.warning("job summary not refreshed: %s", e)

    def close(self) -> None:
        self.conn.close()


def open_store(state_path: Path) -> Store:
    dsn = os.environ.get("DATABASE_URL")
    return PostgresStore(dsn) if dsn else JsonStore(state_path)
