-- Validation for the 30-day experiment: members rate whether a recommended job / fit verdict was relevant, and one
-- view reports the key metrics (relevance %, resume edits accepted without correction, application-to-interview
-- conversion, weekly active users). Run after 032_resume_versions.sql. Safe to re-run.

create table if not exists public.fit_feedback (
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_id     text not null check (char_length(job_id) <= 100),
  relevant   boolean not null,
  verdict    text not null default '' check (verdict in ('', 'strong', 'potential', 'stretch', 'poor')),
  score      integer check (score between 0 and 100),
  place      text not null default '' check (place in ('', 'discover', 'jobs', 'job', 'ats')),
  created_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
alter table public.fit_feedback enable row level security;
grant select, insert, update, delete on public.fit_feedback to authenticated;
drop policy if exists "fit feedback: own rows" on public.fit_feedback;
create policy "fit feedback: own rows" on public.fit_feedback for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- The experiment's metrics, for the team only (query it in the Supabase SQL editor). Not exposed to the API.
create or replace view public.validation_metrics as
select
  (select round(100.0 * avg(relevant::int), 1) from public.fit_feedback where created_at > now() - interval '30 days') as relevant_pct_30d,
  (select count(*) from public.fit_feedback where created_at > now() - interval '30 days') as relevance_votes_30d,
  (select round(100.0 * sum(accepted) / nullif(sum(accepted + kept), 0), 1) from public.resume_versions where created_at > now() - interval '30 days') as edits_accepted_pct_30d,
  (select round(100.0 * count(*) filter (where status in ('interviewing', 'offer') or interview_at is not null or rejection_reason = 'after_interview')
                / nullif(count(*) filter (where applied_at is not null or status in ('applied', 'interviewing', 'offer', 'rejected')), 0), 1)
     from public.tracked_jobs) as application_to_interview_pct,
  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as weekly_active_users;

revoke all on public.validation_metrics from anon, authenticated;
