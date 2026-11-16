-- 051: count clicks on "Apply on company site" (and the employer's job page link), per job, so we can show job-feed
-- partners (NLx, JobTarget, ATS platforms) how many applicants Rolearch sends them. Only members see those links.
-- Nothing personal is stored: no user id, IP address or browser details, only which job and when.
-- The site's server records clicks through record_apply_click() with the service key; visitors can't read or write the table.
-- Safe to re-run.

create table if not exists public.apply_clicks (
  id           bigint generated always as identity primary key,
  job_id       text not null,
  company_key  text,
  source       text,
  country_code char(2),
  created_at   timestamptz not null default now()
);
create index if not exists apply_clicks_created_idx on public.apply_clicks (created_at desc);
create index if not exists apply_clicks_job_idx on public.apply_clicks (job_id);
alter table public.apply_clicks enable row level security;
revoke all on public.apply_clicks from anon, authenticated;

create or replace function public.record_apply_click(p_job_id text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.apply_clicks (job_id, company_key, source, country_code)
  select j.id, j.company_key, j.source, j.country_code
  from public.jobs j
  where j.id = p_job_id;
$$;
revoke all on function public.record_apply_click(text) from public, anon, authenticated;
grant execute on function public.record_apply_click(text) to service_role;

-- Monthly totals for partner conversations. Query in the SQL editor: select * from public.apply_click_stats;
create or replace view public.apply_click_stats as
select
  date_trunc('month', created_at)::date               as month,
  count(*)                                            as apply_clicks,
  count(distinct job_id)                              as jobs_clicked,
  count(distinct company_key)                         as employers_clicked,
  count(*) filter (where country_code = 'US')         as us_apply_clicks
from public.apply_clicks
group by 1
order by 1 desc;
revoke all on public.apply_click_stats from anon, authenticated;
