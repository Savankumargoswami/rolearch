-- 050: the site's job totals stopped updating on 9 Nov 2026. refresh_job_summary_and_vocab() read the whole
-- jobs table (4.6 GB) three to four times: totals, categories, map pins, then vocabulary and sitemap pages.
-- With 1.8M open jobs on a disk-limited database that took longer than the worker's 15-minute limit, so the
-- whole refresh rolled back every run and the site kept showing the 9 Nov figure (1,702,127).
--
-- Now: totals, categories and map pins come from one read of the open jobs, and the worker calls each refresh on
-- its own (summary every run; sitemap pages and vocabulary once a day), so a slow one can't block the totals.
-- Safe to re-run. Takes effect on the next finalize.

create or replace function public.refresh_job_summary()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- One pass over the table: only the narrow columns the summary needs.
  create temporary table _open on commit drop as
    select company, country_code, country, city, category, last_seen_at, lat, lon
    from public.jobs
    where status = 'open';

  insert into public.job_summary as s (id, jobs, companies, countries, updated_at, categories, pins, refreshed_at)
  select 1, t.jobs, t.companies, t.countries, t.updated_at, c.cats, p.pins, now()
  from (select count(*) as jobs, count(distinct company) as companies, count(distinct country_code) as countries,
               max(last_seen_at) as updated_at
        from _open) as t,
       (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc), '[]') as cats
        from (select category, count(*) as n from _open group by category) as x) as c,
       (select coalesce(jsonb_agg(to_jsonb(m) order by m.n desc), '[]') as pins
        from (select initcap(lower(mode() within group (order by o.city))) as city,
                     mode() within group (order by o.country) as country,
                     avg(o.lat) as lat, avg(o.lon) as lon, count(*) as n
              from _open as o
              where o.lat is not null and o.lon is not null and o.city <> 'Remote'
              group by round(o.lat::numeric, 0), round(o.lon::numeric, 0)
              order by n desc
              limit 200) as m) as p
  on conflict (id) do update set jobs = excluded.jobs, companies = excluded.companies, countries = excluded.countries,
    updated_at = excluded.updated_at, categories = excluded.categories, pins = excluded.pins, refreshed_at = excluded.refreshed_at;
end;
$$;

-- The vocabulary (typo check in search) no longer has its own 3-minute cap: the worker sets the limit and runs it once a day.
create or replace function public.refresh_job_vocab()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.job_vocab;
  insert into public.job_vocab (word, n)
  select w, count(*)::int from (
    select regexp_split_to_table(lower(title || ' ' || coalesce(city, '') || ' ' || coalesce(company, '') || ' ' || public.skills_text(skills)), '[^[:alpha:]]+') as w
    from public.jobs where status = 'open'
  ) as x
  where length(w) >= 3
  group by w
  having count(*) >= 3;
$$;

revoke all on function public.refresh_job_summary() from public, anon, authenticated;
revoke all on function public.refresh_job_vocab() from public, anon, authenticated;
