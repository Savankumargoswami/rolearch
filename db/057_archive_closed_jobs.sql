-- 057: moves closed jobs out of public.jobs into public.jobs_archive, a little at a time. On 19 Nov 2026 jobs held
-- about 2.1M open and 1.45M closed rows (17GB). Every scan of the table (finalize's cleanup, the totals, search
-- vocabulary, skill graph) read the closed rows too, on a database with 4GB of memory. The site never shows closed
-- jobs (job pages read open jobs only), so they can live elsewhere.
--
-- Moved: jobs closed more than 30 days ago. Kept in public.jobs:
--   * jobs posted on Rolearch ('rolearch:...'): their applications are deleted with the job (014, on delete cascade)
--   * jobs from feeds employers connected ('feed:...'): their companies manage them
--   * jobs a member saved in their tracker: the outcome stats join them (041)
-- The archive keeps every column except the description (most of the table's size), so counts and history remain.
-- If a moved job reappears on its employer's site, the job refresh adds it again as a new open job.
--
-- Runs every 10 minutes, 10,000 jobs at a time (about 24 hours for 1.45M), so the database never gets a burst.
-- Progress: select count(*) from public.jobs_archive;
-- Stop it: select cron.unschedule('archive-closed-jobs');
-- The freed space is reused by new jobs; the table file only shrinks with a rewrite (pg_repack), not needed.
-- Safe to re-run.

create table if not exists public.jobs_archive (like public.jobs including defaults);
alter table public.jobs_archive drop constraint if exists jobs_archive_pkey;
alter table public.jobs_archive add primary key (id);
alter table public.jobs_archive add column if not exists archived_at timestamptz not null default now();
alter table public.jobs_archive drop column if exists search;  -- the search index text: rebuilt if a job comes back
alter table public.jobs_archive enable row level security;
revoke all on table public.jobs_archive from anon, authenticated;
grant all on table public.jobs_archive to service_role;

create or replace function private.archive_closed_jobs(batch integer default 10000)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  n integer;
begin
  create temporary table _move on commit drop as
    select j.id
    from public.jobs as j
    where j.status = 'closed'  -- jobs_open_idx starts with status, so this finds closed jobs without a full scan
      and j.closed_at < now() - interval '30 days'
      and j.company_key not like 'rolearch:%'
      and j.company_key not like 'feed:%'
      and not exists (select 1 from public.tracked_jobs as t where t.job_id = j.id)
    limit batch;
  with moved as (
    delete from public.jobs as j using _move as m where j.id = m.id
    returning j.*
  )
  insert into public.jobs_archive
    select (jsonb_populate_record(null::public.jobs_archive, to_jsonb(moved) || jsonb_build_object('description', '', 'archived_at', now()))).*
    from moved
  on conflict (id) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function private.archive_closed_jobs(integer) from public;

select cron.unschedule('archive-closed-jobs') where exists (select 1 from cron.job where jobname = 'archive-closed-jobs');
select cron.schedule('archive-closed-jobs', '7,17,27,37,47,57 * * * *', $$set statement_timeout = '5min'; select private.archive_closed_jobs()$$);
