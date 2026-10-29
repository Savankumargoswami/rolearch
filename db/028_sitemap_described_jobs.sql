-- Job sitemaps list only jobs with a full description. Run after 027_roadmaps.sql. Safe to re-run.
-- A job that arrives with just a title and a one-line summary is too thin for search engines to index, so it stays
-- out of the sitemap (and its page says noindex) until a refresh reads its description; then it's listed.
-- pg_column_size reads the stored size without unpacking the text, so this stays fast over every open job:
-- 200 stored bytes is a description of roughly 300 characters or more.

create or replace function public.refresh_sitemap_pages(p_size integer default 20000)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  create temporary table _pages on commit drop as
    select (row_number() over (order by j.id) - 1) / p_size as page,
           jsonb_build_array(j.id, to_char(j.posted_at, 'YYYY-MM-DD')) as item
    from public.jobs as j
    where j.status = 'open' and coalesce(pg_column_size(j.description), 0) >= 200;
  insert into public.sitemap_pages (page, urls, refreshed_at)
    select page, jsonb_agg(item), now() from _pages group by page
    on conflict (page) do update set urls = excluded.urls, refreshed_at = excluded.refreshed_at;
  select coalesce(max(page) + 1, 0) into n from _pages;
  delete from public.sitemap_pages where page >= n;
  return n;
end;
$$;
revoke execute on function public.refresh_sitemap_pages(integer) from public, anon, authenticated;

select public.refresh_sitemap_pages();
