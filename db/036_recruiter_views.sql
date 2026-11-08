-- Recruiter views for application outcome intelligence. Run after 035_open_to_work.sql. Safe to re-run.
--
-- When a company opens an application sent through Rolearch, the first time is recorded. Applicants see only that it
-- was viewed (and when), never who looked. Applications sent elsewhere can't be seen, so the tracker counts a reply
-- from the employer as a view for those.

alter table public.applications add column if not exists viewed_at timestamptz;

-- The company that received the application marks it viewed (first view only).
create or replace function public.mark_application_viewed(p_id uuid) returns void
language sql security definer set search_path = '' as $$
  update public.applications
     set viewed_at = coalesce(viewed_at, now())
   where id = p_id and company_id = (select auth.uid()) and viewed_at is null;
$$;
revoke all on function public.mark_application_viewed(uuid) from public, anon;
grant execute on function public.mark_application_viewed(uuid) to authenticated;

-- The applicant's own applications that a recruiter has opened.
create or replace function public.my_application_views()
returns table (job_id text, viewed_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select a.job_id, a.viewed_at from public.applications a
   where a.applicant_id = (select auth.uid()) and a.viewed_at is not null;
$$;
revoke all on function public.my_application_views() from public, anon;
grant execute on function public.my_application_views() to authenticated;
