-- Company websites by name, for logos on profiles' experience ("Deloitte" -> deloitte.com), from the employers
-- Rolearch already reads. Run after 018_smart_search.sql. Safe to re-run.

create index if not exists jobs_company_lower_idx on public.jobs (lower(company)) where company_domain is not null;

create or replace function public.company_domains(names text[])
returns table (name text, domain text)
language sql stable security definer set search_path = '' as $$
  select distinct on (lower(j.company)) lower(j.company), j.company_domain
  from public.jobs as j
  where j.company_domain is not null
    and lower(j.company) = any (select lower(trim(n)) from unnest(names[1:40]) as n)
  order by lower(j.company), j.last_seen_at desc;
$$;

grant execute on function public.company_domains(text[]) to anon, authenticated;
