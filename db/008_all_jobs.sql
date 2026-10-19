-- All job categories, aggregator sources, and fast server-side search. Run after 007_job_description.sql.

alter table public.jobs add column if not exists category text not null default 'other';
alter table public.jobs add column if not exists verified boolean not null default true; -- false: from an aggregator (Adzuna, USAJOBS)

-- Existing data/ML jobs keep their category.
update public.jobs set category = 'data' where launch_field and category = 'other';

create extension if not exists pg_trgm with schema extensions;

-- array_to_string isn't marked immutable, so generated columns can't call it directly.
create or replace function public.skills_text(text[]) returns text
language sql immutable parallel safe set search_path = '' as $$ select array_to_string($1, ' ') $$;

-- Search text: title weighted highest, then company and skills.
alter table public.jobs add column if not exists search tsvector
  generated always as (
    setweight(to_tsvector('simple', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('simple', coalesce(company, '')), 'B') ||
    setweight(to_tsvector('simple', public.skills_text(skills)), 'B') ||
    setweight(to_tsvector('simple', coalesce(city, '') || ' ' || coalesce(country, '')), 'C')
  ) stored;

create index if not exists jobs_search_idx on public.jobs using gin (search) where status = 'open';
create index if not exists jobs_title_trgm_idx on public.jobs using gin (lower(title) extensions.gin_trgm_ops) where status = 'open';
create index if not exists jobs_category_idx on public.jobs (category, posted_at desc) where status = 'open';
create index if not exists jobs_open_posted_idx on public.jobs (posted_at desc nulls last) where status = 'open';
