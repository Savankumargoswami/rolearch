-- Sitemap files built ahead of time. Counting and paging through every open job on each request grew past the
-- API's 8-second limit (~750k jobs), which failed deployments that build robots.txt and the sitemaps.
-- The worker's refresh (refresh_job_summary_and_vocab) now also fills sitemap_pages; the site reads one row.
-- Run after 020_job_sitemap.sql. Safe to re-run.

create table if not exists public.sitemap_pages (
  page integer primary key,
  urls jsonb not null default '[]',
  refreshed_at timestamptz not null default now()
);
alter table public.sitemap_pages enable row level security;
drop policy if exists "sitemap pages are public" on public.sitemap_pages;
create policy "sitemap pages are public" on public.sitemap_pages for select using (true);

create or replace function public.refresh_sitemap_pages(p_size integer default 20000)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  create temporary table _pages on commit drop as
    select (row_number() over (order by j.id) - 1) / p_size as page,
           jsonb_build_array(j.id, to_char(j.posted_at, 'YYYY-MM-DD')) as item
    from public.jobs as j
    where j.status = 'open';
  insert into public.sitemap_pages (page, urls, refreshed_at)
    select page, jsonb_agg(item), now() from _pages group by page
    on conflict (page) do update set urls = excluded.urls, refreshed_at = excluded.refreshed_at;
  select coalesce(max(page) + 1, 0) into n from _pages;
  delete from public.sitemap_pages where page >= n;
  return n;
end;
$$;
revoke execute on function public.refresh_sitemap_pages(integer) from public, anon, authenticated;

create or replace function public.refresh_job_summary_and_vocab()
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.refresh_job_summary();
  perform public.refresh_job_vocab();
  perform public.refresh_sitemap_pages();
end;
$$;
revoke execute on function public.refresh_job_summary_and_vocab() from public, anon, authenticated;

-- Same names and results as 020, now read from the prebuilt rows (instant).
create or replace function public.job_sitemap_count()
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(jsonb_array_length(urls)), 0)::int from public.sitemap_pages;
$$;

create or replace function public.job_sitemap(p_page integer, p_size integer default 20000)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce((select urls from public.sitemap_pages where page = p_page), '[]'::jsonb);
$$;

grant execute on function public.job_sitemap_count() to anon, authenticated;
grant execute on function public.job_sitemap(integer, integer) to anon, authenticated;

select public.refresh_sitemap_pages();
