-- Consented, anonymised application outcomes: members who opt in add their tracker outcomes to totals across
-- Rolearch (interview rates by job-fit verdict, industry, role, and tailored vs not). Run after 040. Safe to re-run.
--
-- Privacy by design:
--   * Off by default. Members opt in (Settings and privacy, or the tracker) and can opt out any time.
--   * No copy of anyone's data: the totals are recounted nightly from opted-in members' own trackers, so opting out
--     (or deleting the account) removes their applications from the next rebuild.
--   * Counts only, and a group is published only with at least 10 members and 30 applications.
--   * Server-only: the public key can't read the totals or anyone's consent.

-- 1. Consent -------------------------------------------------------------------------------------------------------
create table if not exists public.outcome_consent (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  share      boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.outcome_consent enable row level security;
revoke all on table public.outcome_consent from anon, authenticated;
grant select, insert, update on table public.outcome_consent to authenticated;
grant all on table public.outcome_consent to service_role;
drop policy if exists "outcome consent: own row" on public.outcome_consent;
create policy "outcome consent: own row" on public.outcome_consent for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- 2. Totals --------------------------------------------------------------------------------------------------------
create table if not exists public.outcome_stats (
  dimension  text not null,   -- all | verdict | category | role | tailored
  key        text not null,
  members    int not null,
  sent       int not null,
  responses  int not null,
  interviews int not null,
  offers     int not null,
  updated_at timestamptz not null default now(),
  primary key (dimension, key)
);
alter table public.outcome_stats enable row level security;
revoke all on table public.outcome_stats from anon, authenticated;
grant all on table public.outcome_stats to service_role;

-- Same definitions as src/lib/outcomes.ts: sent, responded (any reply), interviewed.
create or replace function private.refresh_outcome_stats()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  create temp table apps on commit drop as
    select t.user_id,
           coalesce(j.category, 'other') as category,
           j.role_slug,
           (t.resume_version is not null) as tailored,
           coalesce((
             select a.verdict from public.job_analyses as a
             where a.user_id = t.user_id and a.job_key = t.job_id and a.created_at <= coalesce(t.applied_at, t.updated_at)
             order by a.created_at desc limit 1
           ), 'not_checked') as verdict,
           (t.status in ('interviewing', 'offer') or t.interview_at is not null or t.rejection_reason = 'after_interview') as interviewed,
           (t.status = 'offer') as offered,
           t.status, t.rejection_reason, t.log
    from public.tracked_jobs as t
    join public.outcome_consent as c on c.user_id = t.user_id and c.share
    left join public.jobs as j on j.id = t.job_id
    where t.applied_at is not null or t.status in ('applied', 'screen', 'interviewing', 'offer', 'rejected', 'withdrawn');

  create temp table facts on commit drop as
    select user_id, category, role_slug, tailored, verdict, interviewed, offered,
           (interviewed or status = 'screen'
              or exists (select 1 from jsonb_array_elements(log) as e where e ->> 'kind' is distinct from 'status')
              or (status = 'rejected' and rejection_reason not in ('', 'no_response'))) as responded
    from apps;

  delete from public.outcome_stats;
  insert into public.outcome_stats (dimension, key, members, sent, responses, interviews, offers)
    select dimension, key, count(distinct user_id), count(*), count(*) filter (where responded),
           count(*) filter (where interviewed), count(*) filter (where offered)
    from (
      select 'all' as dimension, 'all' as key, * from facts
      union all select 'verdict', verdict, * from facts
      union all select 'category', category, * from facts
      union all select 'role', role_slug, * from facts where role_slug is not null
      union all select 'tailored', case when tailored then 'tailored' else 'not_tailored' end, * from facts
    ) as g
    group by dimension, key
    having count(distinct user_id) >= 10 and count(*) >= 30;
end $$;
revoke all on function private.refresh_outcome_stats() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'outcome-stats';
select cron.schedule('outcome-stats', '0 4 * * *', $$select private.refresh_outcome_stats()$$);
