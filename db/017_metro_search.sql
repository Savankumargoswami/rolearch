-- Metro-area search: "Phoenix" also finds Scottsdale, Tempe, Chandler... the way people expect.
-- Run after 016_company_logos.sql. Safe to re-run. A word (or two-word name like "new york") in the query
-- that names a metro becomes "any city in that metro"; other words still have to match.

create table if not exists public.metros (term text primary key, cities text[] not null);
alter table public.metros enable row level security;
revoke all on public.metros from anon, authenticated;

insert into public.metros (term, cities) values
  ('phoenix', array['phoenix', 'scottsdale', 'tempe', 'chandler', 'mesa', 'glendale', 'gilbert', 'peoria', 'goodyear', 'surprise', 'avondale', 'buckeye', 'queen creek']),
  ('dallas', array['dallas', 'fort worth', 'irving', 'plano', 'arlington', 'frisco', 'richardson', 'addison', 'grand prairie', 'denton', 'mckinney', 'garland', 'carrollton', 'lewisville', 'coppell', 'las colinas']),
  ('houston', array['houston', 'the woodlands', 'sugar land', 'katy', 'pasadena', 'pearland', 'spring', 'conroe', 'baytown', 'cypress', 'humble', 'league city']),
  ('austin', array['austin', 'round rock', 'cedar park', 'georgetown', 'pflugerville', 'san marcos', 'kyle', 'leander']),
  ('seattle', array['seattle', 'bellevue', 'redmond', 'kirkland', 'tacoma', 'everett', 'renton', 'bothell', 'kent', 'issaquah', 'lynnwood']),
  ('chicago', array['chicago', 'evanston', 'naperville', 'schaumburg', 'oak brook', 'aurora', 'elgin', 'joliet', 'downers grove', 'deerfield', 'northbrook', 'rosemont', 'lombard', 'itasca']),
  ('atlanta', array['atlanta', 'alpharetta', 'marietta', 'sandy springs', 'duluth', 'decatur', 'norcross', 'kennesaw', 'roswell', 'peachtree corners', 'smyrna']),
  ('boston', array['boston', 'cambridge', 'somerville', 'waltham', 'quincy', 'newton', 'burlington', 'woburn', 'lexington', 'framingham', 'bedford', 'needham', 'marlborough']),
  ('denver', array['denver', 'aurora', 'englewood', 'lakewood', 'boulder', 'broomfield', 'littleton', 'centennial', 'golden', 'westminster', 'thornton', 'louisville']),
  ('miami', array['miami', 'fort lauderdale', 'boca raton', 'coral gables', 'doral', 'hialeah', 'west palm beach', 'miramar', 'plantation', 'sunrise', 'pembroke pines']),
  ('charlotte', array['charlotte', 'concord', 'gastonia', 'rock hill', 'huntersville', 'matthews', 'fort mill', 'mooresville']),
  ('minneapolis', array['minneapolis', 'saint paul', 'st paul', 'bloomington', 'eden prairie', 'plymouth', 'edina', 'minnetonka', 'maple grove', 'eagan']),
  ('detroit', array['detroit', 'dearborn', 'troy', 'southfield', 'auburn hills', 'warren', 'livonia', 'ann arbor', 'novi', 'farmington hills', 'pontiac']),
  ('philadelphia', array['philadelphia', 'king of prussia', 'conshohocken', 'camden', 'cherry hill', 'malvern', 'wayne', 'horsham', 'blue bell', 'media']),
  ('nashville', array['nashville', 'franklin', 'brentwood', 'murfreesboro', 'smyrna', 'hendersonville']),
  ('orlando', array['orlando', 'kissimmee', 'lake mary', 'sanford', 'winter park', 'maitland', 'altamonte springs']),
  ('tampa', array['tampa', 'st petersburg', 'saint petersburg', 'clearwater', 'brandon', 'largo', 'lakeland']),
  ('raleigh', array['raleigh', 'durham', 'cary', 'chapel hill', 'morrisville', 'research triangle park', 'apex', 'wake forest']),
  ('portland', array['portland', 'beaverton', 'hillsboro', 'lake oswego', 'tigard', 'gresham', 'wilsonville']),
  ('pittsburgh', array['pittsburgh', 'canonsburg', 'cranberry township', 'monroeville', 'bridgeville']),
  ('columbus', array['columbus', 'dublin', 'westerville', 'worthington', 'hilliard', 'new albany', 'grove city']),
  ('indianapolis', array['indianapolis', 'carmel', 'fishers', 'noblesville', 'greenwood', 'zionsville']),
  ('san diego', array['san diego', 'la jolla', 'carlsbad', 'chula vista', 'escondido', 'oceanside', 'san marcos', 'poway']),
  ('los angeles', array['los angeles', 'santa monica', 'burbank', 'pasadena', 'glendale', 'long beach', 'torrance', 'irvine', 'culver city', 'el segundo', 'anaheim', 'santa ana', 'costa mesa', 'newport beach', 'orange']),
  ('bay area', array['san francisco', 'oakland', 'san jose', 'palo alto', 'mountain view', 'sunnyvale', 'santa clara', 'menlo park', 'redwood city', 'fremont', 'cupertino', 'milpitas', 'san mateo', 'berkeley', 'emeryville', 'foster city', 'south san francisco']),
  ('san francisco', array['san francisco', 'oakland', 'south san francisco', 'san mateo', 'redwood city', 'emeryville', 'berkeley', 'daly city', 'burlingame']),
  ('new york', array['new york', 'brooklyn', 'manhattan', 'queens', 'bronx', 'jersey city', 'hoboken', 'newark', 'white plains', 'stamford', 'long island city', 'yonkers']),
  ('nyc', array['new york', 'brooklyn', 'manhattan', 'queens', 'bronx', 'jersey city', 'hoboken', 'long island city']),
  ('washington', array['washington', 'arlington', 'alexandria', 'reston', 'herndon', 'mclean', 'tysons', 'bethesda', 'rockville', 'silver spring', 'fairfax', 'chantilly', 'falls church', 'vienna', 'gaithersburg', 'columbia']),
  ('dc', array['washington', 'arlington', 'alexandria', 'reston', 'herndon', 'mclean', 'tysons', 'bethesda', 'rockville', 'silver spring', 'fairfax', 'falls church']),
  ('salt lake city', array['salt lake city', 'sandy', 'draper', 'lehi', 'west valley city', 'south jordan', 'murray', 'provo', 'orem', 'midvale']),
  ('las vegas', array['las vegas', 'henderson', 'north las vegas', 'paradise', 'summerlin']),
  ('st louis', array['st louis', 'saint louis', 'clayton', 'chesterfield', 'st charles', 'creve coeur', 'maryland heights']),
  ('kansas city', array['kansas city', 'overland park', 'olathe', 'lenexa', 'lee''s summit', 'leawood', 'independence']),
  ('cincinnati', array['cincinnati', 'mason', 'blue ash', 'covington', 'west chester', 'florence']),
  ('cleveland', array['cleveland', 'akron', 'independence', 'beachwood', 'mayfield heights', 'westlake', 'strongsville']),
  ('san antonio', array['san antonio', 'new braunfels', 'schertz', 'boerne']),
  ('sacramento', array['sacramento', 'roseville', 'folsom', 'rancho cordova', 'elk grove', 'davis', 'rocklin']),
  ('toronto', array['toronto', 'mississauga', 'markham', 'brampton', 'vaughan', 'oakville', 'richmond hill', 'north york', 'etobicoke']),
  ('london', array['london', 'canary wharf', 'city of london', 'croydon', 'hammersmith', 'stratford']),
  ('bangalore', array['bangalore', 'bengaluru']),
  ('bengaluru', array['bangalore', 'bengaluru']),
  ('mumbai', array['mumbai', 'navi mumbai', 'thane', 'powai']),
  ('delhi', array['delhi', 'new delhi', 'gurgaon', 'gurugram', 'noida', 'ghaziabad', 'faridabad']),
  ('gurgaon', array['gurgaon', 'gurugram']),
  ('hyderabad', array['hyderabad', 'secunderabad', 'gachibowli', 'hitec city'])
on conflict (term) do update set cities = excluded.cities;

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
  raw_q text;
  parts text[];
  cities text[];
  i integer;
begin
  -- Each word becomes a prefix match ("engin" finds "engineer"); punctuation is dropped.
  words := array(
    select w from unnest(regexp_split_to_array(lower(coalesce(q, '')), '\s+')) as raw,
           lateral (select regexp_replace(raw, '[^[:alnum:]+#]', '', 'g') as w) as clean
    where w <> '' limit 8);
  if cardinality(words) > 0 then
    -- Words naming a metro (one word like "phoenix", or two like "new york") match any city in it.
    raw_q := lower(coalesce(q, ''));
    parts := array[]::text[];
    i := 1;
    while i <= cardinality(words) loop
      cities := null;
      if i < cardinality(words) then
        select m.cities into cities from public.metros as m where m.term = words[i] || ' ' || words[i + 1];
        if cities is not null then
          i := i + 1;
        end if;
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
    tsq := to_tsquery('simple', array_to_string(parts, ' & '));
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
