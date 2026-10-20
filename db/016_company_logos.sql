-- Company logos: each job carries its employer's website domain; the site shows that site's icon
-- (fetched and cached through rolearch.com, so visitors' browsers never contact a third party).
-- Run after 015_feedback.sql. Safe to re-run. The worker fills company_domain for feed jobs
-- (worker/companies/companies.csv "domain" column); jobs posted on Rolearch use the company's website.

alter table public.jobs add column if not exists company_domain text;

-- Rolearch-posted jobs: the poster's website host.
update public.jobs as j
set company_domain = lower(regexp_replace(regexp_replace(p.website, '^https?://', '', 'i'), '^www\.|[/:?#].*$', '', 'gi'))
from public.profiles as p
where j.posted_by = p.id and coalesce(p.website, '') <> '' and j.company_domain is null;

create or replace function public.set_posted_job_domain()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.posted_by is not null and new.company_domain is null then
    select nullif(lower(regexp_replace(regexp_replace(website, '^https?://', '', 'i'), '^www\.|[/:?#].*$', '', 'gi')), '')
    into new.company_domain from public.profiles where id = new.posted_by;
  end if;
  return new;
end;
$$;
drop trigger if exists jobs_posted_domain on public.jobs;
create trigger jobs_posted_domain before insert on public.jobs for each row when (new.posted_by is not null) execute function public.set_posted_job_domain();

-- search_jobs now also returns company_domain (its result type changes, so it's recreated).
drop function if exists public.search_jobs(text, text, text, boolean, boolean, boolean, text, text, integer, integer);

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
  skills text[], posted_at timestamptz, category text, verified boolean, source text, company_domain text, total bigint
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
             j.skills, j.posted_at, j.category, j.verified, j.source, j.company_domain, n
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
           h.skills, h.posted_at, h.category, h.verified, h.source, h.company_domain, (select c from cnt)
    from page join public.jobs as h on h.id = page.id
    order by page.rank desc, page.posted_at desc nulls last, page.id;
end;
$$;

grant execute on function public.search_jobs(text, text, text, boolean, boolean, boolean, text, text, integer, integer) to anon, authenticated;
