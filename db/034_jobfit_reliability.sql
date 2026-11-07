-- JobFit reliability: candidate corrections (confirmed gaps, confirmed skills, evidence marked wrong), saved
-- analyses with their scoring version (reproducible results and a dashboard history), problem reports on an
-- analysis, and per-user usage counts for rate-limiting the AI features. Run after 033_validation.sql. Safe to re-run.

-- What a member told us about one skill: "lack" = confirmed gap, "have" = they confirm they have it,
-- "wrong" = the evidence we matched is inaccurate. Keyed by the lowercased skill name.
create table if not exists public.fit_corrections (
  user_id    uuid not null references auth.users (id) on delete cascade,
  skill_key  text not null check (char_length(skill_key) between 1 and 80),
  kind       text not null check (kind in ('lack', 'have', 'wrong')),
  note       text not null default '' check (char_length(note) <= 500),
  created_at timestamptz not null default now(),
  primary key (user_id, skill_key)
);

-- A saved JobFit result: score, category, scoring version and a snapshot of the requirement-level output.
create table if not exists public.job_analyses (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_key    text not null check (char_length(job_key) <= 120),
  title      text not null default '' check (char_length(title) <= 200),
  company    text not null default '' check (char_length(company) <= 120),
  score      integer not null check (score between 0 and 100),
  verdict    text not null check (verdict in ('strong', 'potential', 'stretch', 'poor', 'insufficient')),
  version    text not null check (char_length(version) <= 40),
  snapshot   jsonb not null,
  created_at timestamptz not null default now(),
  constraint job_analyses_snapshot_size check (pg_column_size(snapshot) <= 100000)
);
create index if not exists job_analyses_user_idx on public.job_analyses (user_id, created_at desc);

-- "Report a problem with this analysis": wrong match, wrong fact, privacy concern, other.
create table if not exists public.analysis_reports (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_key    text not null default '' check (char_length(job_key) <= 120),
  kind       text not null check (kind in ('wrong_match', 'wrong_fact', 'privacy', 'other')),
  note       text not null default '' check (char_length(note) <= 2000),
  version    text not null default '' check (char_length(version) <= 40),
  created_at timestamptz not null default now()
);

-- One row per expensive AI action, for per-user rate limits.
create table if not exists public.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  kind    text not null check (char_length(kind) <= 40),
  at      timestamptz not null default now()
);
create index if not exists ai_usage_user_idx on public.ai_usage (user_id, kind, at desc);

alter table public.fit_corrections enable row level security;
alter table public.job_analyses enable row level security;
alter table public.analysis_reports enable row level security;
alter table public.ai_usage enable row level security;

grant select, insert, update, delete on public.fit_corrections, public.job_analyses to authenticated;
grant select, insert on public.analysis_reports, public.ai_usage to authenticated;

drop policy if exists "fit corrections: own rows" on public.fit_corrections;
create policy "fit corrections: own rows" on public.fit_corrections for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "job analyses: own rows" on public.job_analyses;
create policy "job analyses: own rows" on public.job_analyses for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "analysis reports: own rows" on public.analysis_reports;
create policy "analysis reports: own rows" on public.analysis_reports for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
drop policy if exists "ai usage: own rows" on public.ai_usage;
create policy "ai usage: own rows" on public.ai_usage for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Old usage rows aren't needed after a day.
create or replace function public.prune_ai_usage() returns void language sql security definer set search_path = '' as $$
  delete from public.ai_usage where at < now() - interval '2 days';
$$;
revoke all on function public.prune_ai_usage() from public, anon, authenticated;

-- Settings & Privacy: a member deletes their own account. Every table keyed to auth.users cascades, so profile,
-- tracker, resume versions, analyses, corrections, votes, skill tests and applications go with it. Uploaded files
-- are removed by the app through the storage API first.
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  delete from auth.users where id = (select auth.uid());
end;
$$;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------- Application tracker lifecycle (blueprint 7.2) ----------
-- Adds Analyzing, Ready to apply, Recruiter screen and Withdrawn to the existing statuses (saved = Interested,
-- interviewing = Interview), and mirrors the employer's "screening" and "withdrawn" stages into them.
alter table public.tracked_jobs drop constraint if exists tracked_jobs_status_check;
alter table public.tracked_jobs add constraint tracked_jobs_status_check
  check (status in ('saved', 'analyzing', 'ready', 'applied', 'screen', 'interviewing', 'offer', 'rejected', 'withdrawn', 'archived'));

create or replace function public.tracker_status_for(p_stage text)
returns text language sql immutable set search_path = '' as $$
  select case p_stage when 'screening' then 'screen' when 'interview' then 'interviewing' when 'offer' then 'offer'
                      when 'hired' then 'offer' when 'rejected' then 'rejected' when 'withdrawn' then 'withdrawn' else 'applied' end;
$$;

-- ---------- Onboarding preferences (blueprint 2.2 B) ----------
-- { "target_roles": [...], "experience": "3-5", "locations": [...], "work_mode": "remote|hybrid|onsite|any" }
alter table public.profiles add column if not exists preferences jsonb not null default '{}'::jsonb;
grant update (preferences) on public.profiles to authenticated;

-- ---------- Product analytics events (blueprint 10.1) ----------
-- Event names and small properties only: never resume text, job descriptions or contact details.
create table if not exists public.product_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references auth.users (id) on delete cascade,
  event      text not null check (event ~ '^[a-z_]{3,40}$'),
  props      jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists product_events_event_idx on public.product_events (event, created_at desc);
alter table public.product_events enable row level security;
grant insert on public.product_events to authenticated;
drop policy if exists "product events: insert own" on public.product_events;
create policy "product events: insert own" on public.product_events for insert to authenticated with check (user_id = (select auth.uid()));

-- Blueprint KPIs (10.2) for the team, alongside validation_metrics. Query in the SQL editor.
create or replace view public.kpi_metrics as
select
  (select count(distinct user_id) from public.job_analyses where created_at > now() - interval '30 days') as activated_users_30d,
  (select count(*) from public.job_analyses where created_at > now() - interval '30 days') as analyses_30d,
  (select round(100.0 * count(*) filter (where exists (
            select 1 from public.tracked_jobs tj where tj.user_id = a.user_id and tj.job_id = a.job_key and tj.created_at >= a.created_at - interval '1 day'))
          / nullif(count(*), 0), 1)
     from public.job_analyses a where a.created_at > now() - interval '30 days') as analysis_to_action_pct,
  (select count(distinct user_id) from public.job_analyses where created_at > now() - interval '7 days'
     and user_id in (select user_id from public.job_analyses where created_at between now() - interval '35 days' and now() - interval '21 days')) as retained_week4_users,
  (select count(*) from public.analysis_reports where created_at > now() - interval '30 days') as problem_reports_30d,
  (select count(*) from public.fit_corrections where created_at > now() - interval '30 days') as corrections_30d;
revoke all on public.kpi_metrics from anon, authenticated;

-- The cover letter used for each tracked application (blueprint 7.6: each application keeps its exact documents).
alter table public.tracked_jobs add column if not exists cover_letter text not null default '' check (char_length(cover_letter) <= 8000);

-- Match votes can also be on an "insufficient information" result.
alter table public.fit_feedback drop constraint if exists fit_feedback_verdict_check;
alter table public.fit_feedback add constraint fit_feedback_verdict_check check (verdict in ('', 'strong', 'potential', 'stretch', 'poor', 'insufficient'));

-- validation_metrics (db/033) counted interviews and applications with the old statuses; include the new ones.
create or replace view public.validation_metrics as
select
  (select round(100.0 * avg(relevant::int), 1) from public.fit_feedback where created_at > now() - interval '30 days') as relevant_pct_30d,
  (select count(*) from public.fit_feedback where created_at > now() - interval '30 days') as relevance_votes_30d,
  (select round(100.0 * sum(accepted) / nullif(sum(accepted + kept), 0), 1) from public.resume_versions where created_at > now() - interval '30 days') as edits_accepted_pct_30d,
  (select round(100.0 * count(*) filter (where status in ('interviewing', 'offer') or interview_at is not null or rejection_reason = 'after_interview')
                / nullif(count(*) filter (where applied_at is not null or status in ('applied', 'screen', 'interviewing', 'offer', 'rejected', 'withdrawn')), 0), 1)
     from public.tracked_jobs) as application_to_interview_pct,
  (select count(*) from auth.users where last_sign_in_at > now() - interval '7 days') as weekly_active_users;
revoke all on public.validation_metrics from anon, authenticated;
