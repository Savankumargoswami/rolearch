"""Where jobs go: a JSON state file (no setup) or Postgres/Supabase (DATABASE_URL)."""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Protocol

from .models import Company

DROP_GUARD = 20  # a board that had this many open jobs and suddenly returns 0 is treated as a feed failure


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store(Protocol):
    def previous_count(self, company: Company) -> int: ...
    def known_ids(self, company: Company) -> set[str]: ...
    def save(self, company: Company, jobs: list[dict]) -> tuple[int, int, int]: ...
    def record_error(self, company: Company, error: str) -> None: ...
    def retire_companies(self, keep: set[str]) -> int: ...
    def open_jobs(self, launch_only: bool, limit: int) -> list[dict]: ...
    def close(self) -> None: ...


class JsonStore:
    """Keeps every job ever seen with first/last-seen times and open/closed status."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.data = json.loads(path.read_text("utf-8")) if path.exists() else {"companies": {}, "jobs": {}}

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

    def retire_companies(self, keep: set[str]) -> int:
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
        "salary_currency salary_period level years skills summary department job_url apply_url source launch_field lat lon posted_at"
    ).split()

    def __init__(self, dsn: str) -> None:
        import psycopg

        self.conn = psycopg.connect(dsn, autocommit=False)

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
               values (%s, %s, %s, %s, %s, %s, now(), case when %s is null then now() end, %s, %s)
               on conflict (key) do update set name = excluded.name, country = excluded.country, careers_url = excluded.careers_url,
                 last_run_at = now(),
                 last_ok_at = coalesce(excluded.last_ok_at, companies.last_ok_at),
                 last_job_count = coalesce(excluded.last_job_count, companies.last_job_count),
                 last_error = excluded.last_error""",
            (company.key, company.name, company.country, company.ats, company.token, company.careers_url, error, count, error),
        )

    def save(self, company: Company, jobs: list[dict]) -> tuple[int, int, int]:
        rows = [
            (
                j["id"], company.key, j["dedupeKey"], j["title"], j["company"], j["city"], j["country"], j["countryCode"],
                j["region"], j["workplace"], j["visa"],
                (j["salary"] or {}).get("min"), (j["salary"] or {}).get("max"), (j["salary"] or {}).get("currency"),
                (j["salary"] or {}).get("period"), j["level"], j["years"], j["skills"], j["summary"], j["department"],
                j["jobUrl"], j["applyUrl"], j["source"], j["launchField"], j["lat"], j["lon"], j["postedAt"],
            )
            for j in jobs
        ]
        cols = ", ".join(self.COLS)
        marks = ", ".join(["%s"] * len(self.COLS))
        updates = ", ".join(f"{c} = excluded.{c}" for c in self.COLS if c != "id")
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
            cur.execute(
                """update jobs set status = 'closed', closed_at = now()
                   where company_key = %s and status = 'open' and not (id = any(%s))""",
                (company.key, [j["id"] for j in jobs]),
            )
            closed = cur.rowcount
        self.conn.commit()
        added = sum(1 for j in jobs if j["id"] not in known)
        return added, len(jobs) - added, closed

    def record_error(self, company: Company, error: str) -> None:
        with self.conn.cursor() as cur:
            self._company(cur, company, None, error[:500])
        self.conn.commit()

    def retire_companies(self, keep: set[str]) -> int:
        with self.conn.cursor() as cur:
            cur.execute(
                "update jobs set status = 'closed', closed_at = now() where status = 'open' and not (company_key = any(%s))",
                (list(keep),),
            )
            cur.execute("update companies set active = (key = any(%s))", (list(keep),))
            n = cur.rowcount
        self.conn.commit()
        return n

    def open_jobs(self, launch_only: bool, limit: int) -> list[dict]:
        raise NotImplementedError("With a database, the website reads jobs from Supabase directly.")

    def close(self) -> None:
        self.conn.close()


def open_store(state_path: Path) -> Store:
    dsn = os.environ.get("DATABASE_URL")
    return PostgresStore(dsn) if dsn else JsonStore(state_path)
