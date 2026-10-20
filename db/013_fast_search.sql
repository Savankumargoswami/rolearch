-- Fast search and site totals for hundreds of thousands of open jobs. Run after 012_job_requirements.sql. Safe to re-run.
-- Public requests have a short statement timeout, so nothing a visitor triggers may scan every open job:
--   * totals, category counts and map pins are precomputed into job_summary by refresh_job_summary(),
--     which the worker calls after each run;
--   * search walks the posted_at / category indexes, ranks at most the newest 5,000 matches of a text
--     query, and stops counting matches at 10,000 (the site shows "10,000+");
--   * search runs as its owner: Postgres won't use the full-text index under the jobs row-level
--     security policy (the @@ operator isn't leakproof), so visitors' searches fell back to full scans.

create table if not exists public.job_summary (
  id integer primary key default 1 check (id = 1),
  jobs bigint not null default 0,
  companies bigint not null default 0,
  countries bigint not null default 0,
  updated_at timestamptz,
  categories jsonb not null default '[]',
  pins jsonb not null default '[]',
  refreshed_at timestamptz not null default now()
);
alter table public.job_summary enable row level security;
drop policy if exists "job summary is public" on public.job_summary;
create policy "job summary is public" on public.job_summary for select using (true);
grant select on public.job_summary to anon, authenticated;

create or replace function public.refresh_job_summary()
returns void
language sql
security definer
set search_path = ''
set statement_timeout = '120s'
as $$
  insert into public.job_summary as s (id, jobs, companies, countries, updated_at, categories, pins, refreshed_at)
  select 1, t.jobs, t.companies, t.countries, t.updated_at, c.cats, p.pins, now()
  from (select count(*) as jobs, count(distinct company) as companies, count(distinct country_code) as countries, max(last_seen_at) as updated_at
        from public.jobs where status = 'open') as t,
       (select coalesce(jsonb_agg(jsonb_build_object('category', category, 'n', n) order by n desc), '[]') as cats
        from (select category, count(*) as n from public.jobs where status = 'open' group by category) as x) as c,
       (select coalesce(jsonb_agg(to_jsonb(m) order by m.n desc), '[]') as pins
        from (select initcap(lower(mode() within group (order by j.city))) as city,
                     mode() within group (order by j.country) as country,
                     avg(j.lat) as lat, avg(j.lon) as lon, count(*) as n
              from public.jobs as j
              where j.status = 'open' and j.lat is not null and j.lon is not null and j.city <> 'Remote'
              group by round(j.lat::numeric, 0), round(j.lon::numeric, 0)
              order by n desc
              limit 200) as m) as p
  on conflict (id) do update set jobs = excluded.jobs, companies = excluded.companies, countries = excluded.countries,
    updated_at = excluded.updated_at, categories = excluded.categories, pins = excluded.pins, refreshed_at = excluded.refreshed_at;
$$;

revoke execute on function public.refresh_job_summary() from public, anon, authenticated;

-- Same signatures as before, now reading the summary.
create or replace function public.job_stats()
returns table (jobs bigint, companies bigint, countries bigint, updated_at timestamptz)
language sql stable security invoker set search_path = ''
as $$ select jobs, companies, countries, updated_at from public.job_summary where id = 1; $$;

create or replace function public.job_categories()
returns table (category text, n bigint)
language sql stable security invoker set search_path = ''
as $$
  select e->>'category', (e->>'n')::bigint
  from public.job_summary, jsonb_array_elements(categories) as e
  where id = 1;
$$;

create or replace function public.job_map(max_pins integer default 80)
returns table (city text, country text, lat double precision, lon double precision, n bigint)
language sql stable security invoker set search_path = ''
as $$
  select e->>'city', e->>'country', (e->>'lat')::double precision, (e->>'lon')::double precision, (e->>'n')::bigint
  from public.job_summary, jsonb_array_elements(pins) with ordinality as x(e, i)
  where id = 1 and x.i <= least(greatest(coalesce(max_pins, 80), 1), 200)
  order by x.i;
$$;

grant execute on function public.job_stats() to anon, authenticated;
grant execute on function public.job_categories() to anon, authenticated;
grant execute on function public.job_map(integer) to anon, authenticated;

create index if not exists jobs_visa_posted_idx on public.jobs (posted_at desc nulls last) where status = 'open' and visa;
create index if not exists jobs_remote_posted_idx on public.jobs (posted_at desc nulls last) where status = 'open' and workplace = 'remote';
create index if not exists jobs_pay_posted_idx on public.jobs (posted_at desc nulls last) where status = 'open' and salary_min is not null;
create index if not exists jobs_region_posted_idx on public.jobs (region, posted_at desc nulls last) where status = 'open';

create or replace function public.search_jobs(
  q text default '',
  cat text default '',
  region_in text default '',
  remote_only boolean default false,
  visa_only boolean default false,
  pay_only boolean default false,
  lvl text default '',
  sort text default 'relevance',
  lim integer default 40,
  off integer default 0
)
returns table (
  id text, title text, company text, city text, country text, region text, workplace text, visa boolean,
  salary_min numeric, salary_max numeric, salary_currency text, salary_period text, level text, years integer,
  skills text[], posted_at timestamptz, category text, verified boolean, source text, total bigint
)
language plpgsql
stable
security definer  -- see note above: under row-level security the text index can't be used, so the
                  -- function reads as its owner and returns only open jobs' public columns itself.
set search_path = ''
as $$
declare
  words text[];
  tsq tsquery;
  phrase text := nullif(lower(trim(coalesce(q, ''))), '');
  cats text[];
  n bigint;
  page_size integer := least(greatest(coalesce(lim, 40), 1), 100);
  skip integer := least(greatest(coalesce(off, 0), 0), 10000);
  plain boolean;
begin
  -- Each word becomes a prefix match ("engin" finds "engineer"); punctuation is dropped.
  words := array(
    select w from unnest(regexp_split_to_array(lower(coalesce(q, '')), '\s+')) as raw,
           lateral (select regexp_replace(raw, '[^[:alnum:]+#]', '', 'g') as w) as clean
    where w <> '' limit 8);
  if cardinality(words) > 0 then
    tsq := to_tsquery('simple', array_to_string(array(select quote_literal(w) || ':*' from unnest(words) as w), ' & '));
  end if;
  cats := case cat
            when 'white' then array['software','data','engineering','design','marketing','sales','finance','hr','legal','science','admin','education','customer','social']
            when 'blue' then array['driving','logistics','trades','manufacturing','facilities','hospitality','retail','security']
            when '' then null
            else array[cat]
          end;
  plain := coalesce(region_in, '') = '' and not remote_only and not visa_only and not pay_only and coalesce(lvl, '') = '';

  if tsq is null then
    -- Browsing: exact totals come from the summary; filtered totals are counted up to 10,000.
    if plain then
      select coalesce(sum((e->>'n')::bigint), 0) into n
      from public.job_summary, jsonb_array_elements(categories) as e
      where job_summary.id = 1 and (cats is null or e->>'category' = any(cats));
    else
      select count(*) into n from (
        select 1 from public.jobs as j
        where j.status = 'open'
          and (cats is null or j.category = any(cats))
          and (coalesce(region_in, '') = '' or (region_in = 'remote' and j.workplace = 'remote') or j.region = region_in)
          and (not remote_only or j.workplace = 'remote')
          and (not visa_only or j.visa)
          and (not pay_only or j.salary_min is not null)
          and (coalesce(lvl, '') = '' or j.level = lvl)
        limit 10000) as c;
    end if;
    return query
      select j.id, j.title, j.company, j.city, j.country, j.region, j.workplace, j.visa,
             j.salary_min, j.salary_max, j.salary_currency, j.salary_period, j.level, j.years,
             j.skills, j.posted_at, j.category, j.verified, j.source, n
      from public.jobs as j
      where j.status = 'open'
        and (cats is null or j.category = any(cats))
        and (coalesce(region_in, '') = '' or (region_in = 'remote' and j.workplace = 'remote') or j.region = region_in)
        and (not remote_only or j.workplace = 'remote')
        and (not visa_only or j.visa)
        and (not pay_only or j.salary_min is not null)
        and (coalesce(lvl, '') = '' or j.level = lvl)
      order by j.posted_at desc nulls last, j.id
      limit page_size offset skip;
    return;
  end if;

  -- Text query: one pass collects up to 10,000 matches (the count), then the newest 5,000 are ranked.
  return query
    with m as materialized (
      select j.id, j.search, j.title, j.posted_at from public.jobs as j
      where j.status = 'open' and j.search @@ tsq
        and (cats is null or j.category = any(cats))
        and (coalesce(region_in, '') = '' or (region_in = 'remote' and j.workplace = 'remote') or j.region = region_in)
        and (not remote_only or j.workplace = 'remote')
        and (not visa_only or j.visa)
        and (not pay_only or j.salary_min is not null)
        and (coalesce(lvl, '') = '' or j.level = lvl)
      limit 10000
    ),
    cnt as (select count(*) as c from m),
    cand as (select * from m order by m.posted_at desc nulls last limit 5000),
    page as (
      select cand.id,
             case when sort = 'newest' then 0
                  else ts_rank(cand.search, tsq) + case when strpos(lower(cand.title), phrase) > 0 then 1 else 0 end
             end as rank,
             cand.posted_at
      from cand
      order by 2 desc, cand.posted_at desc nulls last, cand.id
      limit page_size offset skip
    )
    select h.id, h.title, h.company, h.city, h.country, h.region, h.workplace, h.visa,
           h.salary_min, h.salary_max, h.salary_currency, h.salary_period, h.level, h.years,
           h.skills, h.posted_at, h.category, h.verified, h.source, (select c from cnt)
    from page join public.jobs as h on h.id = page.id
    order by page.rank desc, page.posted_at desc nulls last, page.id;
end;
$$;

grant execute on function public.search_jobs(text, text, text, boolean, boolean, boolean, text, text, integer, integer) to anon, authenticated;

-- Site requests get a little more room than Supabase's default 3 s while the indexes warm up.
alter role anon set statement_timeout = '8s';
alter role authenticated set statement_timeout = '8s';
notify pgrst, 'reload config';

select public.refresh_job_summary();
