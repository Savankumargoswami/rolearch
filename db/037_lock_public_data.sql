-- Lock the job database to the server. Run after 036_recruiter_views.sql, and ONLY once SUPABASE_SERVICE_ROLE_KEY is
-- set in Vercel (Production) and the site has been redeployed: the server then reads job data with that key, and the
-- public anon key (which every browser can see) no longer reaches it. Safe to re-run. Undo: 037_rollback.sql.
--
-- Before: anyone could copy every open job straight from the REST API with the anon key, or page through search_jobs,
-- and call the maintenance functions directly (those check a secret, but there's no reason to expose them).
-- After: job data, search, sitemaps and roadmaps are server-only. Members still read jobs posted on Rolearch (to
-- apply) and companies read their own postings through row-level security.

-- 1. Jobs table: no public read. Members see open Rolearch postings; companies see their own (policy from 014).
drop policy if exists "open jobs are public" on public.jobs;
drop policy if exists "jobs: members read open Rolearch postings" on public.jobs;
create policy "jobs: members read open Rolearch postings" on public.jobs
  for select to authenticated using (status = 'open' and posted_by is not null);
revoke all on table public.jobs from anon;
revoke insert, update, delete, truncate on table public.jobs from authenticated;
grant select on table public.jobs to authenticated;
grant all on table public.jobs to service_role;

-- 2. Other job data tables: server only.
do $$
declare
  t text;
begin
  foreach t in array array['companies', 'job_summary', 'role_titles', 'sitemap_pages', 'job_vocab', 'metros'] loop
    if to_regclass('public.' || t) is not null then
      execute format('revoke all on table public.%I from anon, authenticated', t);
      execute format('grant all on table public.%I to service_role', t);
    end if;
  end loop;
end $$;

-- 3. Functions the server calls with its own key: search, map, sitemap, stats, roadmaps, and the secret-guarded
--    maintenance functions. Every overload, by name.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'search_jobs', 'job_map', 'job_sitemap', 'job_sitemap_count', 'job_stats', 'job_categories', 'correct_query',
        'company_domains', 'roadmap_list', 'jobs_digest', 'feedback_since', 'newsletter_recipients',
        'newsletter_unsubscribe', 'post_author_email', 'publish_rolearch_post', 'save_job_description',
        'save_job_requirements'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;
