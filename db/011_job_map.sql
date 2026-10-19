-- City pins for the home page map: open jobs grouped into ~1° cells (one pin per metro area).
-- Run after 010_oauth_names.sql. Safe to re-run.
create or replace function public.job_map(max_pins integer default 80)
returns table (city text, country text, lat double precision, lon double precision, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select initcap(lower(mode() within group (order by j.city))) as city,
         mode() within group (order by j.country) as country,
         avg(j.lat) as lat, avg(j.lon) as lon, count(*) as n
  from public.jobs as j
  where j.status = 'open' and j.lat is not null and j.lon is not null and j.city <> 'Remote'
  group by round(j.lat::numeric, 0), round(j.lon::numeric, 0)
  order by n desc
  limit least(greatest(coalesce(max_pins, 80), 1), 200);
$$;

grant execute on function public.job_map(integer) to anon, authenticated;
