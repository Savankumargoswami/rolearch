-- 054: role pages (/roles/{role} and /roles/{role}/{place}) read their jobs from a saved copy instead of running a
-- live job search on every visit. Under database load the live search ran past the site's 8-second query limit;
-- the page then showed "couldn't load these jobs" with 0 jobs and told Google not to index it (19 of 20 sampled,
-- 19 Nov 2026). Here a scheduled job refreshes a few pages at a time, oldest first, so every page is refreshed
-- several times a day and a page visit is a single quick lookup.
-- The site fills role_listings with one row per page (role, place, search words, filters) every day
-- (/api/cron/role-listings); this job fills in the jobs. Run after 018 (search_jobs). Safe to re-run.
-- Server-only: the site reads it with the server key.
-- Progress: select count(*) filter (where refreshed_at > now() - interval '1 day'), count(*) from public.role_listings;

create table if not exists public.role_listings (
  role_slug    text not null,
  place_slug   text not null default '',
  q            text not null,
  remote_only  boolean not null default false,
  visa_only    boolean not null default false,
  near_lat     double precision,
  near_lon     double precision,
  total        int,
  jobs         jsonb,       -- up to 30 search_jobs rows, the ones whose title names the role when 5+ do
  paid         jsonb,       -- the same from listings that publish pay (for the page's pay figure)
  refreshed_at timestamptz,
  failed_at    timestamptz,
  primary key (role_slug, place_slug)
);
alter table public.role_listings enable row level security;
revoke all on table public.role_listings from anon, authenticated;
grant all on table public.role_listings to service_role;

-- The search behind one page: the 100 best matches, then those whose title names every word of the role.
create or replace function private.role_listing_rows(l public.role_listings, pay boolean)
returns table (rows jsonb, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with hits as (
    select s.*, row_number() over () as n
    from public.search_jobs(q => l.q, remote_only => l.remote_only, visa_only => l.visa_only, pay_only => pay,
                            lim => 100, near_lat => l.near_lat, near_lon => l.near_lon,
                            near_only => l.near_lat is not null, country_in => 'US') as s
  ),
  titled as (
    select h.* from hits h
    where not exists (
      select 1 from unnest(regexp_split_to_array(lower(trim(l.q)), '\s+')) as w
      where h.title !~* ('\m' || w)
    )
  ),
  chosen as (
    select * from titled where (select count(*) from titled) >= 5
    union all
    select * from hits where (select count(*) from titled) < 5
  )
  select coalesce((select jsonb_agg(to_jsonb(c) - 'n' - 'total' order by c.n) from (select * from chosen order by n limit 30) c), '[]'::jsonb),
         coalesce((select max(h.total) from hits h), 0);
$$;

-- Refreshes the pages refreshed longest ago, for up to `budget` of time (a pg_cron run must end within its limit).
create or replace function private.refresh_role_listings(budget interval default '150 seconds')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  started timestamptz := clock_timestamp();
  l public.role_listings;
  j jsonb; p jsonb; t bigint;
  done int := 0;
begin
  for l in
    select * from public.role_listings
    order by greatest(refreshed_at, failed_at) asc nulls first
    limit 60
  loop
    exit when clock_timestamp() - started > budget;
    begin
      select r.rows, r.total into j, t from private.role_listing_rows(l, false) r;
      select r.rows into p from private.role_listing_rows(l, true) r;
      update public.role_listings set jobs = j, paid = p, total = t, refreshed_at = now(), failed_at = null
      where role_slug = l.role_slug and place_slug = l.place_slug;
      done := done + 1;
    exception when others then
      -- A slow or failed search: try this page again later, after the others.
      update public.role_listings set failed_at = now() where role_slug = l.role_slug and place_slug = l.place_slug;
    end;
  end loop;
  return done;
end;
$$;

-- Every 5 minutes, about 2.5 minutes of work: one page at a time, so the database never gets a burst.
select cron.unschedule('role-listings') where exists (select 1 from cron.job where jobname = 'role-listings');
select cron.schedule('role-listings', '*/5 * * * *', $$set statement_timeout = '4min'; select private.refresh_role_listings()$$);
