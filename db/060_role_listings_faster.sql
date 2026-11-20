-- 060: role pages (054) fill faster and never lose a run's work.
-- On 20 Nov 2026 the first run on production saved nothing: one page's search ran past the run's 4-minute limit, and
-- the cancel undid every page that run had already finished (a cancel isn't caught by "when others"). Each page also
-- ran two searches (all jobs, then jobs with pay), 12-18 seconds each under load.
-- Now: one search per page, the pay list taken from the same 100 matches; a cancel ends the run but keeps what it
-- finished. Replaces 054's refresh function; the 5-minute schedule stays as it is. Safe to re-run.

-- One page's jobs, its listings that publish pay (null when fewer than 3, so the page works its pay out itself), and
-- the total, from a single search.
create or replace function private.role_listing_page(l public.role_listings)
returns table (rows jsonb, paid jsonb, total bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with hits as (
    select s.*, row_number() over () as n
    from public.search_jobs(q => l.q, remote_only => l.remote_only, visa_only => l.visa_only, pay_only => false,
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
  ),
  pay as (select * from chosen where salary_min is not null)
  select coalesce((select jsonb_agg(to_jsonb(c) - 'n' - 'total' order by c.n) from (select * from chosen order by n limit 30) c), '[]'::jsonb),
         case when (select count(*) from pay) >= 3
              then (select jsonb_agg(to_jsonb(p) - 'n' - 'total' order by p.n) from (select * from pay order by n limit 30) p) end,
         coalesce((select max(h.total) from hits h), 0);
$$;
revoke all on function private.role_listing_page(public.role_listings) from public;

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
      select r.rows, r.paid, r.total into j, p, t from private.role_listing_page(l) r;
      update public.role_listings set jobs = j, paid = p, total = t, refreshed_at = now(), failed_at = null
      where role_slug = l.role_slug and place_slug = l.place_slug;
      done := done + 1;
    exception
      when query_canceled then
        -- The run's time limit: mark this page to retry later and stop, keeping the pages already done.
        update public.role_listings set failed_at = now() where role_slug = l.role_slug and place_slug = l.place_slug;
        exit;
      when others then
        -- A failed search: try this page again later, after the others.
        update public.role_listings set failed_at = now() where role_slug = l.role_slug and place_slug = l.place_slug;
    end;
  end loop;
  return done;
end;
$$;
