-- One row per scheduled job per period, so a run delivered twice (Vercel Schedules can repeat a run) does its work
-- only once: the job claims (job, period) before working and skips if the claim already exists. Server-only.
-- Run after 038. Safe to re-run.

create table if not exists public.job_runs (
  job text not null,
  period text not null,
  ran_at timestamptz not null default now(),
  primary key (job, period)
);
alter table public.job_runs enable row level security;
revoke all on table public.job_runs from anon, authenticated;
grant all on table public.job_runs to service_role;
