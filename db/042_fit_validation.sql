-- Does the job-fit score predict interviews? Measured nightly on applications from members who share their outcomes
-- (db/041). Run after 041. Safe to re-run. Server-only.
--
-- fit_validation rows:
--   kind 'band'    : score band (0-39, 40-59, 60-79, 80-100) -> applications, interviews, interview rate and its 95%
--                    Wilson interval.
--   kind 'summary' : all scored applications -> AUC, the chance a random interviewed application scored higher than a
--                    random one without an interview (0.5 = no better than chance, 1 = perfect).
-- The site states the score is validated only when the evidence is strong (src/lib/fit-validation.ts).

create table if not exists public.fit_validation (
  kind       text not null,
  key        text not null,
  n          int not null,
  interviews int not null,
  rate       real not null,
  lo         real not null,
  hi         real not null,
  auc        real,
  updated_at timestamptz not null default now(),
  primary key (kind, key)
);
alter table public.fit_validation enable row level security;
revoke all on table public.fit_validation from anon, authenticated;
grant all on table public.fit_validation to service_role;

-- 95% Wilson score interval for x successes in n trials.
create or replace function private.wilson(x bigint, n bigint, upper boolean)
returns real
language sql
immutable
set search_path = ''
as $$
  select case when n = 0 then 0 else (
    (x::float8 / n + 1.96 ^ 2 / (2 * n) + case when upper then 1 else -1 end
      * 1.96 * sqrt((x::float8 / n) * (1 - x::float8 / n) / n + 1.96 ^ 2 / (4.0 * n * n)))
    / (1 + 1.96 ^ 2 / n))::real end
$$;

create or replace function private.refresh_fit_validation()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Each shared application with the last fit score taken before applying (same rules as refresh_outcome_stats).
  create temp table scored on commit drop as
    select s.score,
           (t.status in ('interviewing', 'offer') or t.interview_at is not null or t.rejection_reason = 'after_interview') as interviewed
    from public.tracked_jobs as t
    join public.outcome_consent as c on c.user_id = t.user_id and c.share
    cross join lateral (
      select a.score from public.job_analyses as a
      where a.user_id = t.user_id and a.job_key = t.job_id and a.created_at <= coalesce(t.applied_at, t.updated_at)
      order by a.created_at desc limit 1
    ) as s
    where t.applied_at is not null or t.status in ('applied', 'screen', 'interviewing', 'offer', 'rejected', 'withdrawn');

  delete from public.fit_validation;

  insert into public.fit_validation (kind, key, n, interviews, rate, lo, hi)
    select 'band', band, count(*), count(*) filter (where interviewed),
           (count(*) filter (where interviewed))::real / count(*),
           private.wilson(count(*) filter (where interviewed), count(*), false),
           private.wilson(count(*) filter (where interviewed), count(*), true)
    from (
      select case when score >= 80 then '80-100' when score >= 60 then '60-79' when score >= 40 then '40-59' else '0-39' end as band, interviewed
      from scored
    ) as b
    group by band;

  -- AUC by the rank-sum (Mann-Whitney) method, with tied scores sharing their average rank.
  insert into public.fit_validation (kind, key, n, interviews, rate, lo, hi, auc)
    select 'summary', 'all', count(*), sum(i::int),
           avg(i::int)::real,
           private.wilson(sum(i::int), count(*), false),
           private.wilson(sum(i::int), count(*), true),
           case when sum(i::int) > 0 and sum(i::int) < count(*) then
             ((sum(r) filter (where i) - sum(i::int) * (sum(i::int) + 1) / 2.0) / (sum(i::int) * (count(*) - sum(i::int))))::real
           end
    from (
      select interviewed as i,
             rank() over (order by score) + (count(*) over (partition by score) - 1) / 2.0 as r
      from scored
    ) as ranked
    having count(*) > 0;
end $$;
revoke all on all functions in schema private from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'fit-validation';
select cron.schedule('fit-validation', '15 4 * * *', $$select private.refresh_fit_validation()$$);
