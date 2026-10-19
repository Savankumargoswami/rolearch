-- Server-side job search across every open job. Run after 008_all_jobs.sql. Safe to re-run.
-- Runs with the caller's rights (security invoker): row-level security still limits it to open jobs.

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
language sql
stable
security invoker
set search_path = ''
as $$
  with words as (
    -- Each word becomes a prefix match ("engin" finds "engineer"); punctuation is dropped.
    select array(
      select w from unnest(regexp_split_to_array(lower(coalesce(q, '')), '\s+')) as raw,
             lateral (select regexp_replace(raw, '[^[:alnum:]+#]', '', 'g') as w) as clean
      where w <> ''
      limit 8
    ) as list
  ),
  query as (
    select case when cardinality(list) = 0 then null
                else to_tsquery('simple', array_to_string(array(select quote_literal(w) || ':*' from unnest(list) as w), ' & '))
           end as tsq,
           nullif(lower(trim(coalesce(q, ''))), '') as phrase
    from words
  ),
  groups as (
    select case cat
             when 'white' then array['software','data','engineering','design','marketing','sales','finance','hr','legal','science','admin','education','customer','social']
             when 'blue' then array['driving','logistics','trades','manufacturing','facilities','hospitality','retail','security']
             when '' then null
             else array[cat]
           end as cats
  ),
  hits as (
    select j.*,
           case when qr.tsq is null then 0
                else ts_rank(j.search, qr.tsq) + case when strpos(lower(j.title), qr.phrase) > 0 then 1 else 0 end
           end as rank
    from public.jobs as j, query as qr, groups as g
    where j.status = 'open'
      and (qr.tsq is null or j.search @@ qr.tsq)
      and (g.cats is null or j.category = any(g.cats))
      and (coalesce(region_in, '') = '' or (region_in = 'remote' and j.workplace = 'remote') or j.region = region_in)
      and (not remote_only or j.workplace = 'remote')
      and (not visa_only or j.visa)
      and (not pay_only or j.salary_min is not null)
      and (coalesce(lvl, '') = '' or j.level = lvl)
  )
  select h.id, h.title, h.company, h.city, h.country, h.region, h.workplace, h.visa,
         h.salary_min, h.salary_max, h.salary_currency, h.salary_period, h.level, h.years,
         h.skills, h.posted_at, h.category, h.verified, h.source, count(*) over () as total
  from hits as h
  order by case when sort = 'newest' then 0 else h.rank end desc, h.posted_at desc nulls last, h.id
  limit least(greatest(coalesce(lim, 40), 1), 100)
  offset greatest(coalesce(off, 0), 0);
$$;

grant execute on function public.search_jobs(text, text, text, boolean, boolean, boolean, text, text, integer, integer) to anon, authenticated;

-- Totals for the home page and jobs header.
create or replace function public.job_stats()
returns table (jobs bigint, companies bigint, countries bigint, updated_at timestamptz)
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*), count(distinct company), count(distinct country_code), max(last_seen_at)
  from public.jobs where status = 'open';
$$;

grant execute on function public.job_stats() to anon, authenticated;

-- Category counts for the browse chips.
create or replace function public.job_categories()
returns table (category text, n bigint)
language sql
stable
security invoker
set search_path = ''
as $$
  select category, count(*) from public.jobs where status = 'open' group by category order by 2 desc;
$$;

grant execute on function public.job_categories() to anon, authenticated;
