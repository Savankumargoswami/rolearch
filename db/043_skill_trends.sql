-- Monthly Skills Report (rolearch.com/reports/skills): how often open job postings ask for each skill, overall and by
-- industry, kept month by month so the report can show what's rising and falling. Run after 040. Safe to re-run.
-- Server-only: the site reads it with the server key.
--
-- skill_trends rows, one set per month (the current month is refreshed nightly and freezes when the month ends):
--   category 'all' or a job category (software, healthcare, ...)
--   skill    a skill name, or '*' = postings read (open jobs with skills tagged), or 'ai' = postings asking for at
--            least one AI skill (machine learning, deep learning, LLMs, NLP, computer vision, MLOps, PyTorch,
--            TensorFlow, scikit-learn)
--   jobs     how many open postings

create table if not exists public.skill_trends (
  month      date not null,
  category   text not null,
  skill      text not null,
  jobs       int not null,
  updated_at timestamptz not null default now(),
  primary key (month, category, skill)
);
alter table public.skill_trends enable row level security;
revoke all on table public.skill_trends from anon, authenticated;
grant all on table public.skill_trends to service_role;

create or replace function private.snapshot_skill_trends()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  m date := date_trunc('month', now())::date;
  ai text[] := array['Machine learning', 'Deep learning', 'LLMs', 'NLP', 'Computer vision', 'MLOps', 'PyTorch', 'TensorFlow', 'scikit-learn'];
begin
  create temp table trend_jobs on commit drop as
    select coalesce(nullif(j.category, ''), 'other') as category, j.skills
    from public.jobs as j
    where j.status = 'open' and j.skills <> '{}';

  delete from public.skill_trends where month = m;

  insert into public.skill_trends (month, category, skill, jobs)
    select m, coalesce(x.category, 'all'), x.skill, count(*)
    from (select t.category, s.skill from trend_jobs as t cross join lateral unnest(t.skills) as s(skill)) as x
    group by grouping sets ((x.category, x.skill), (x.skill));

  insert into public.skill_trends (month, category, skill, jobs)
    select m, coalesce(t.category, 'all'), '*', count(*) from trend_jobs as t group by grouping sets ((t.category), ());

  insert into public.skill_trends (month, category, skill, jobs)
    select m, coalesce(t.category, 'all'), 'ai', count(*) from trend_jobs as t where t.skills && ai group by grouping sets ((t.category), ());
end $$;
revoke all on all functions in schema private from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'skill-trends';
select cron.schedule('skill-trends', '45 4 * * *', $$select private.snapshot_skill_trends()$$);

-- First snapshot: a one-time background job that runs within a minute and then removes itself (the snapshot takes
-- longer than the SQL editor allows, so it isn't run here directly).
select cron.unschedule(jobid) from cron.job where jobname = 'skill-trends-first';
select cron.schedule('skill-trends-first', '* * * * *', $$select private.snapshot_skill_trends(); select cron.unschedule('skill-trends-first')$$);
