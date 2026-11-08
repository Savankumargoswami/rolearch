-- Undo 037_lock_public_data.sql: restores public read of open jobs and anon access to the job functions.
-- Only for an emergency (for example, if SUPABASE_SERVICE_ROLE_KEY turns out to be missing in Vercel).

drop policy if exists "jobs: members read open Rolearch postings" on public.jobs;
drop policy if exists "open jobs are public" on public.jobs;
create policy "open jobs are public" on public.jobs for select to anon, authenticated using (status = 'open');
grant select on table public.jobs to anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['job_summary', 'role_titles', 'sitemap_pages'] loop
    if to_regclass('public.' || t) is not null then
      execute format('grant select on table public.%I to anon, authenticated', t);
    end if;
  end loop;
end $$;

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
    execute format('grant execute on function %s to anon, authenticated', r.sig);
  end loop;
end $$;
