-- Search by country ("remote jobs in india", "nurse in usa"), a 'match most words' mode for queries no single job
-- matches in full, and wider typo correction. Run after 021_sitemap_pages.sql. Safe to re-run.

-- No index on country_code: one on (country_code, posted_at) made the planner pick it for every text search, which
-- turned "nurse" from 0.4s into a timeout. Country filtering rides on the text and browse plans instead.
drop index if exists public.jobs_open_country_idx;

-- Typo vocabulary: job titles and cities as before, plus company names and skills ("microsfot", "pyhton").
create or replace function public.refresh_job_vocab()
returns void language sql security definer set search_path = '' set statement_timeout = '180s' as $$
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
revoke execute on function public.refresh_job_vocab() from public, anon, authenticated;

-- Same rules as 018, and a wrong first letter is also fixed in longer words ("ngineer" -> "engineer", 1 edit).
create or replace function public.correct_query(q text)
returns text language plpgsql stable security definer set search_path = '' as $$
declare
  w text;
  own integer;
  best text;
  best_n integer;
  out_words text[] := '{}';
  changed boolean := false;
begin
  foreach w in array regexp_split_to_array(lower(trim(coalesce(q, ''))), '\s+') loop
    w := regexp_replace(w, '[^[:alnum:]+#]', '', 'g');
    continue when w = '';
    best := null;
    if length(w) >= 4 and w !~ '\d' and not exists (select 1 from public.metros where term = w) then
      select v.n into own from public.job_vocab as v where v.word = w;
      if own is null or own < 50 then
        select v.word, v.n into best, best_n from public.job_vocab as v
        where abs(length(v.word) - length(w)) <= 2
          and v.word <> w
          and (left(v.word, 1) = left(w, 1) or length(w) >= 6)
          and extensions.levenshtein(v.word, w) <= case when left(v.word, 1) = left(w, 1) then 2 else 1 end
        order by extensions.levenshtein(v.word, w) - 0.3 * ln(v.n) asc
        limit 1;
        -- A known word is only replaced by something much more common.
        if best is not null and own is not null and best_n < 30 * own then
          best := null;
        end if;
      end if;
    end if;
    if best is not null then
      changed := true;
      out_words := out_words || best;
    else
      out_words := out_words || w;
    end if;
  end loop;
  return case when changed then array_to_string(out_words, ' ') end;
end;
$$;
grant execute on function public.correct_query(text) to anon, authenticated;

drop function if exists public.search_jobs(text, text, text, boolean, boolean, boolean, text, text, integer, integer, double precision, double precision, boolean);

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
  off integer default 0,
  near_lat double precision default null,
  near_lon double precision default null,
  near_only boolean default false,
  country_in text default '',
  match_any boolean default false
)
returns table (
  id text, title text, company text, city text, country text, region text, workplace text, visa boolean,
  salary_min numeric, salary_max numeric, salary_currency text, salary_period text, level text, years integer,
  skills text[], posted_at timestamptz, category text, verified boolean, source text, company_domain text, total bigint
)
language plpgsql
stable
security definer  -- under row-level security the full-text index can't be used; reads open jobs' public columns only
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
  parts text[];
  cities text[];
  i integer;
  has_near boolean := near_lat is not null and near_lon is not null;
  dlat double precision := 1.0;                                   -- about 110 km
  dlon double precision := 1.0 / greatest(cos(radians(coalesce(near_lat, 0))), 0.2);
begin
  words := array(
    select w from unnest(regexp_split_to_array(lower(coalesce(q, '')), '\s+')) as raw,
           lateral (select regexp_replace(raw, '[^[:alnum:]+#]', '', 'g') as w) as clean
    where w <> '' limit 8);
  if cardinality(words) > 0 then
    parts := array[]::text[];
    i := 1;
    while i <= cardinality(words) loop
      cities := null;
      if i < cardinality(words) then
        select m.cities into cities from public.metros as m where m.term = words[i] || ' ' || words[i + 1];
        if cities is not null then i := i + 1; end if;
      end if;
      if cities is null then
        select m.cities into cities from public.metros as m where m.term = words[i];
      end if;
      if cities is not null then
        parts := parts || ('(' || array_to_string(array(
          select array_to_string(array(select quote_literal(t) from unnest(regexp_split_to_array(c, '\s+')) as t), ' <-> ')
          from unnest(cities) as c), ' | ') || ')');
      else
        parts := parts || (quote_literal(words[i]) || ':*');
      end if;
      i := i + 1;
    end loop;
    -- every word must match; with match_any, any word may, and jobs matching more of them rank higher
    tsq := to_tsquery('simple', array_to_string(parts, case when match_any then ' | ' else ' & ' end));
  end if;
  cats := case cat
            when 'white' then array['software','data','engineering','design','marketing','sales','finance','hr','legal','science','admin','education','customer','social']
            when 'blue' then array['driving','logistics','trades','manufacturing','facilities','hospitality','retail','security']
            when '' then null
            else array[cat]
          end;
  plain := coalesce(region_in, '') = '' and coalesce(country_in, '') = '' and not remote_only and not visa_only and not pay_only and coalesce(lvl, '') = '';
  if not has_near then near_only := false; end if;

  if tsq is null then
    -- Browsing.
    if plain and not near_only then
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
        and (coalesce(country_in, '') = '' or j.country_code = upper(country_in))
          and (not near_only or (j.lat between near_lat - dlat and near_lat + dlat and j.lon between near_lon - dlon and near_lon + dlon))
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
        and (coalesce(country_in, '') = '' or j.country_code = upper(country_in))
        and (not near_only or (j.lat between near_lat - dlat and near_lat + dlat and j.lon between near_lon - dlon and near_lon + dlon))
      order by j.posted_at desc nulls last, j.id
      limit page_size offset skip;
    return;
  end if;

  -- Text query: matches anywhere (up to 10,000, for the count) plus matches near the person (so they're never
  -- crowded out), then the newest 5,000 of those are ranked; nearby ones get a boost unless sorting by date.
  return query
    with m as materialized (
      select j.id, j.search, j.title, j.posted_at, j.lat, j.lon from public.jobs as j
      where j.status = 'open' and j.search @@ tsq
        and (cats is null or j.category = any(cats))
        and (coalesce(region_in, '') = '' or (region_in = 'remote' and j.workplace = 'remote') or j.region = region_in)
        and (not remote_only or j.workplace = 'remote')
        and (not visa_only or j.visa)
        and (not pay_only or j.salary_min is not null)
        and (coalesce(lvl, '') = '' or j.level = lvl)
        and (coalesce(country_in, '') = '' or j.country_code = upper(country_in))
        and (not near_only or (j.lat between near_lat - dlat and near_lat + dlat and j.lon between near_lon - dlon and near_lon + dlon))
      limit 10000
    ),
    nearby as materialized (
      select j.id, j.search, j.title, j.posted_at, j.lat, j.lon from public.jobs as j
      where has_near and j.status = 'open' and j.search @@ tsq
        and j.lat between near_lat - dlat and near_lat + dlat and j.lon between near_lon - dlon and near_lon + dlon
        and (cats is null or j.category = any(cats))
        and (coalesce(region_in, '') = '' or (region_in = 'remote' and j.workplace = 'remote') or j.region = region_in)
        and (not remote_only or j.workplace = 'remote')
        and (not visa_only or j.visa)
        and (not pay_only or j.salary_min is not null)
        and (coalesce(lvl, '') = '' or j.level = lvl)
        and (coalesce(country_in, '') = '' or j.country_code = upper(country_in))
      limit 2000
    ),
    cnt as (select count(*) as c from m),
    cand as (
      select * from (select * from m order by m.posted_at desc nulls last limit 5000) as newest
      union
      select * from nearby
    ),
    page as (
      select cand.id,
             case when sort = 'newest' then 0
                  else ts_rank(cand.search, tsq) + case when strpos(lower(cand.title), phrase) > 0 then 1 else 0 end
                       + case when has_near and cand.lat between near_lat - dlat and near_lat + dlat
                                            and cand.lon between near_lon - dlon and near_lon + dlon then 1.5 else 0 end
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

grant execute on function public.search_jobs(text, text, text, boolean, boolean, boolean, text, text, integer, integer, double precision, double precision, boolean, text, boolean) to anon, authenticated;

select public.refresh_job_vocab();
