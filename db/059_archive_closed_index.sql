-- 059: lets the archive (057) find jobs closed over 30 days ago without reading every closed job.
-- On 20 Nov 2026 each 10-minute archive run read all ~1.5M closed rows (17GB table) looking for the few closed before
-- 21 Oct, and was cancelled at its 5-minute limit: no jobs moved, and the database spent half its time on it.
--
-- Run in this order:
--
-- 1. Pause the archive (quick):
select cron.unschedule('archive-closed-jobs') where exists (select 1 from cron.job where jobname = 'archive-closed-jobs');
--
-- 2. Build the index. It reads the table once (about 40 minutes, like db/053) without blocking the site.
--    The SQL editor gives up after a few minutes and leaves the index broken, so run this over a direct connection
--    (psql or a script), not the editor. If an earlier try left it broken: drop index concurrently public.jobs_closed_at_idx;
create index concurrently if not exists jobs_closed_at_idx on public.jobs (closed_at) where status = 'closed';
--
-- 3. Restart the archive once the index is built (select indisvalid from pg_index
--    where indexrelid = 'public.jobs_closed_at_idx'::regclass  → true):
select cron.schedule('archive-closed-jobs', '7,17,27,37,47,57 * * * *', $$set statement_timeout = '5min'; select private.archive_closed_jobs()$$);
