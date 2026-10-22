-- Open job ids for the public sitemaps search engines read (Google for Jobs). Run after 019_company_domains.sql.
-- Each page comes back as one JSON array, because the API caps the number of rows a call returns. Safe to re-run.

create index if not exists jobs_open_id_idx on public.jobs (id) include (posted_at) where status = 'open';

create or replace function public.job_sitemap_count()
returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.jobs where status = 'open';
$$;

create or replace function public.job_sitemap(p_page integer, p_size integer default 20000)
returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_array(id, to_char(posted_at, 'YYYY-MM-DD'))), '[]'::jsonb)
  from (
    select j.id, j.posted_at
    from public.jobs as j
    where j.status = 'open'
    order by j.id
    offset greatest(p_page, 0) * least(greatest(p_size, 1), 50000)
    limit least(greatest(p_size, 1), 50000)
  ) as page;
$$;

grant execute on function public.job_sitemap_count() to anon, authenticated;
grant execute on function public.job_sitemap(integer, integer) to anon, authenticated;
