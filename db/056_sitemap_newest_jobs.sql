-- 056: job sitemaps list the newest 200,000 described jobs, newest first, instead of every open job (1.9M on
-- 19 Nov 2026). Google gives a new site a small crawl budget: from 1.9M URLs it sampled at random and indexed almost
-- none (2 jobs in Search Console's Job Postings report). Fresh jobs are also the ones searchers want and the ones
-- Google's job search shows. Raise p_max as Google crawls more (Search Console, Crawl stats).
-- Also leaves out postings that aren't a job ("join our talent community", "general application"): Google's job
-- posting guidelines exclude them, and the job page marks them noindex too.
-- Replaces 028's version. Runs in the daily finalize step; reading the newest jobs through jobs_open_posted_idx is
-- much quicker than the old scan of every open job. Safe to re-run.

-- The old one-argument version would make a call with no arguments ambiguous.
drop function if exists public.refresh_sitemap_pages(integer);

create or replace function public.refresh_sitemap_pages(p_size integer default 20000, p_max integer default 200000)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  create temporary table _pages on commit drop as
    select (row_number() over (order by d.posted_at desc nulls last, d.id) - 1) / p_size as page,
           jsonb_build_array(d.id, to_char(d.posted_at, 'YYYY-MM-DD')) as item
    from (
      select j.id, j.posted_at
      from public.jobs as j
      where j.status = 'open'
        and coalesce(pg_column_size(j.description), 0) >= 200  -- a description of roughly 300 characters or more (028)
        and j.title !~* '(talent (community|pool|network)|general application|open application|expression of interest|future opportunit|join our team)'
      order by j.posted_at desc nulls last, j.id
      limit p_max
    ) as d;
  insert into public.sitemap_pages (page, urls, refreshed_at)
    select page, jsonb_agg(item), now() from _pages group by page
    on conflict (page) do update set urls = excluded.urls, refreshed_at = excluded.refreshed_at;
  select coalesce(max(page) + 1, 0) into n from _pages;
  delete from public.sitemap_pages where page >= n;
  return n;
end;
$$;
revoke execute on function public.refresh_sitemap_pages(integer, integer) from public, anon, authenticated;
