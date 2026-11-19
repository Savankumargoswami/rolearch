-- 053: a small index of open jobs by when they were last seen, with their company. The finalize step after each job
-- refresh used to scan the whole jobs table (about 17GB) twice to close jobs of removed companies and jobs no run has
-- seen in 3 days; on the busy database those scans ran past the 10-minute limit and finalize failed, which also
-- left the site totals stale (Nov 2026). With this index both are quick.
-- Builds without locking the table (concurrently), so run it on its own, not inside a transaction. Safe to re-run.
-- It can take several minutes on the full table.

create index concurrently if not exists jobs_open_seen_idx
  on public.jobs (last_seen_at) include (company_key)
  where status = 'open';
