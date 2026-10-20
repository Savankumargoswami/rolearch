-- Direct hiring on Rolearch: companies post jobs, members apply with their profile, companies move applicants
-- through a pipeline, and every member keeps a job tracker. Run after 013_fast_search.sql. Safe to re-run.
--
-- Writes go through security definer functions that check who is calling (auth.uid()). Posting and applying
-- also require the server's review secret, so they only happen through the site's server actions (which run
-- the Claude review and the match scoring), never straight from a browser.

-- ---------- Jobs posted on Rolearch ----------
alter table public.jobs add column if not exists posted_by uuid references auth.users (id) on delete set null;
alter table public.jobs add column if not exists questions jsonb not null default '[]';
alter table public.jobs add column if not exists employment_type text not null default 'full_time';
create index if not exists jobs_posted_by_idx on public.jobs (posted_by, status) where posted_by is not null;

-- ---------- Applications and their history ----------
create table if not exists public.applications (
  id               uuid primary key default gen_random_uuid(),
  job_id           text not null references public.jobs (id) on delete cascade,
  applicant_id     uuid not null references auth.users (id) on delete cascade,
  company_id       uuid not null references auth.users (id) on delete cascade, -- the job's poster, kept here for access rules
  stage            text not null default 'new' check (stage in ('new', 'screening', 'interview', 'offer', 'hired', 'rejected', 'withdrawn')),
  answers          jsonb not null default '[]',   -- [{question, answer}]
  note             text not null default '',      -- the applicant's short note to the company
  snapshot         jsonb not null,                -- profile and résumé as sent: {name, email, headline, location, avatar, links, resume}
  match_score      integer,
  match            jsonb not null default '{}',   -- {verdict, missing[], reqs[]}
  ats_score        integer,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  stage_changed_at timestamptz not null default now(),
  unique (job_id, applicant_id)
);
create index if not exists applications_company_idx on public.applications (company_id, job_id, stage);
create index if not exists applications_applicant_idx on public.applications (applicant_id, created_at desc);

create table if not exists public.application_events (
  id             bigint generated always as identity primary key,
  application_id uuid not null references public.applications (id) on delete cascade,
  actor_id       uuid references auth.users (id) on delete set null,
  kind           text not null check (kind in ('applied', 'stage', 'note', 'message', 'withdrawn')),
  from_stage     text,
  to_stage       text,
  body           text not null default '',
  created_at     timestamptz not null default now()
);
create index if not exists application_events_app_idx on public.application_events (application_id, created_at);

alter table public.applications enable row level security;
alter table public.application_events enable row level security;
grant select on public.applications to authenticated;
grant select on public.application_events to authenticated;

drop policy if exists "applications: applicant or company" on public.applications;
create policy "applications: applicant or company" on public.applications for select to authenticated
  using (applicant_id = (select auth.uid()) or company_id = (select auth.uid()));

-- Companies see the whole history; applicants see everything except the company's private notes.
drop policy if exists "application events: visible to the two sides" on public.application_events;
create policy "application events: visible to the two sides" on public.application_events for select to authenticated
  using (exists (
    select 1 from public.applications a
    where a.id = application_id
      and (a.company_id = (select auth.uid()) or (a.applicant_id = (select auth.uid()) and kind <> 'note'))
  ));

-- ---------- Job page views (for the company's analytics) ----------
create table if not exists public.job_views (
  job_id text not null references public.jobs (id) on delete cascade,
  day    date not null default current_date,
  views  integer not null default 0,
  primary key (job_id, day)
);
alter table public.job_views enable row level security;
grant select on public.job_views to authenticated;
drop policy if exists "job views: the poster" on public.job_views;
create policy "job views: the poster" on public.job_views for select to authenticated
  using (exists (select 1 from public.jobs j where j.id = job_id and j.posted_by = (select auth.uid())));

-- ---------- Job tracker (every member) ----------
create table if not exists public.tracked_jobs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_id     text not null,
  status     text not null default 'saved' check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'archived')),
  title      text not null default '',
  company    text not null default '',
  url        text not null default '',
  notes      text not null default '',
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, job_id)
);
alter table public.tracked_jobs enable row level security;
grant select, insert, update, delete on public.tracked_jobs to authenticated;
drop policy if exists "tracker: own rows" on public.tracked_jobs;
create policy "tracker: own rows" on public.tracked_jobs for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- Functions ----------

-- A verified company account (sign-up email on the company's own domain) posts a reviewed job.
create or replace function public.post_job(
  p_secret text, p_title text, p_city text, p_country text, p_country_code text, p_region text, p_workplace text,
  p_employment text, p_level text, p_years integer, p_skills text[], p_category text, p_summary text, p_description text,
  p_salary_min numeric, p_salary_max numeric, p_currency text, p_period text, p_visa boolean, p_questions jsonb
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_key text;
  v_id text;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'job was not reviewed';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.account_type is distinct from 'company' then raise exception 'only company accounts can post jobs'; end if;
  if not v_profile.company_domain_matches then raise exception 'company not verified'; end if;

  v_key := 'rolearch:' || v_uid::text;
  insert into public.companies (key, name, country, ats, token, careers_url, active)
  values (v_key, coalesce(nullif(v_profile.company_name, ''), 'Company'), coalesce(nullif(upper(p_country_code), ''), 'US'), 'rolearch', v_uid::text, v_profile.website, true)
  on conflict (key) do update set name = excluded.name, careers_url = excluded.careers_url, active = true;

  v_id := left(trim(both '-' from regexp_replace(lower(coalesce(v_profile.company_name, '') || '-' || p_title), '[^a-z0-9]+', '-', 'g')), 70)
          || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8);

  insert into public.jobs (
    id, company_key, dedupe_key, title, company, city, country, country_code, region, workplace, visa,
    salary_min, salary_max, salary_currency, salary_period, level, years, skills, summary, description, department,
    job_url, apply_url, source, category, verified, posted_at, status, posted_by, questions, employment_type
  ) values (
    v_id, v_key, v_id, left(p_title, 160), coalesce(nullif(v_profile.company_name, ''), 'Company'), left(coalesce(p_city, ''), 80),
    left(coalesce(p_country, ''), 80), nullif(upper(left(coalesce(p_country_code, ''), 2)), ''), coalesce(nullif(p_region, ''), 'global'),
    p_workplace, coalesce(p_visa, false), p_salary_min, p_salary_max, nullif(p_currency, ''), nullif(p_period, ''),
    p_level, greatest(coalesce(p_years, 0), 0), coalesce(p_skills, '{}'), left(coalesce(p_summary, ''), 600), left(coalesce(p_description, ''), 20000), '',
    'https://www.rolearch.com/jobs/' || v_id, 'https://www.rolearch.com/jobs/' || v_id || '/apply', 'Rolearch',
    coalesce(nullif(p_category, ''), 'other'), true, now(), 'open', v_uid, coalesce(p_questions, '[]'), coalesce(nullif(p_employment, ''), 'full_time')
  );
  return v_id;
end;
$$;

-- The poster closes or reopens their job.
create or replace function public.set_job_status(p_job text, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_status not in ('open', 'closed') then raise exception 'bad status'; end if;
  update public.jobs set status = p_status, closed_at = case when p_status = 'closed' then now() end,
         last_seen_at = now(), posted_at = case when p_status = 'open' and status = 'closed' then now() else posted_at end
  where id = p_job and posted_by = (select auth.uid());
  if not found then raise exception 'not your job'; end if;
end;
$$;

-- Tracker status that mirrors a pipeline stage, for the applicant's tracker.
create or replace function public.tracker_status_for(p_stage text)
returns text language sql immutable set search_path = '' as $$
  select case p_stage when 'interview' then 'interviewing' when 'offer' then 'offer' when 'hired' then 'offer'
                      when 'rejected' then 'rejected' when 'withdrawn' then 'archived' else 'applied' end;
$$;

-- A member applies with their profile. The server action builds the snapshot and match scores.
create or replace function public.apply_to_job(
  p_secret text, p_job text, p_answers jsonb, p_note text, p_snapshot jsonb, p_match_score integer, p_match jsonb, p_ats_score integer
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_job public.jobs;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'application was not prepared by the site';
  end if;
  select * into v_job from public.jobs where id = p_job;
  if v_job.id is null or v_job.status <> 'open' or v_job.posted_by is null then raise exception 'this job is not taking applications'; end if;
  if v_job.posted_by = v_uid then raise exception 'you posted this job'; end if;

  insert into public.applications (job_id, applicant_id, company_id, answers, note, snapshot, match_score, match, ats_score)
  values (p_job, v_uid, v_job.posted_by, coalesce(p_answers, '[]'), left(coalesce(p_note, ''), 2000), p_snapshot, p_match_score, coalesce(p_match, '{}'), p_ats_score)
  returning id into v_id;
  insert into public.application_events (application_id, actor_id, kind, to_stage) values (v_id, v_uid, 'applied', 'new');

  insert into public.tracked_jobs (user_id, job_id, status, title, company, url, applied_at)
  values (v_uid, p_job, 'applied', v_job.title, v_job.company, '/jobs/' || p_job, now())
  on conflict (user_id, job_id) do update set status = 'applied', applied_at = now(), updated_at = now();
  return v_id;
end;
$$;

-- The company moves an applicant, optionally with a message the applicant sees.
create or replace function public.set_application_stage(p_app uuid, p_stage text, p_message text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
begin
  if p_stage not in ('new', 'screening', 'interview', 'offer', 'hired', 'rejected') then raise exception 'bad stage'; end if;
  select * into v_app from public.applications where id = p_app and company_id = (select auth.uid());
  if v_app.id is null then raise exception 'not your applicant'; end if;
  if v_app.stage = 'withdrawn' then raise exception 'the applicant withdrew'; end if;
  if v_app.stage = p_stage and coalesce(p_message, '') = '' then return; end if;
  update public.applications set stage = p_stage, updated_at = now(),
         stage_changed_at = case when stage <> p_stage then now() else stage_changed_at end
  where id = p_app;
  insert into public.application_events (application_id, actor_id, kind, from_stage, to_stage, body)
  values (p_app, (select auth.uid()), case when v_app.stage = p_stage then 'message' else 'stage' end, v_app.stage, p_stage, left(coalesce(p_message, ''), 4000));
  update public.tracked_jobs set status = public.tracker_status_for(p_stage), updated_at = now()
  where user_id = v_app.applicant_id and job_id = v_app.job_id;
end;
$$;

-- A private note (company only) or a message to the applicant.
create or replace function public.add_application_event(p_app uuid, p_kind text, p_body text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if p_kind not in ('note', 'message') then raise exception 'bad kind'; end if;
  if coalesce(trim(p_body), '') = '' then raise exception 'empty'; end if;
  if not exists (select 1 from public.applications where id = p_app and company_id = (select auth.uid())) then
    raise exception 'not your applicant';
  end if;
  insert into public.application_events (application_id, actor_id, kind, body) values (p_app, (select auth.uid()), p_kind, left(p_body, 4000));
  update public.applications set updated_at = now() where id = p_app;
end;
$$;

-- The applicant withdraws.
create or replace function public.withdraw_application(p_app uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_app public.applications;
begin
  select * into v_app from public.applications where id = p_app and applicant_id = (select auth.uid());
  if v_app.id is null then raise exception 'not your application'; end if;
  update public.applications set stage = 'withdrawn', updated_at = now(), stage_changed_at = now() where id = p_app;
  insert into public.application_events (application_id, actor_id, kind, from_stage, to_stage) values (p_app, (select auth.uid()), 'withdrawn', v_app.stage, 'withdrawn');
  update public.tracked_jobs set status = 'archived', updated_at = now() where user_id = v_app.applicant_id and job_id = v_app.job_id;
end;
$$;

-- One more view of a Rolearch-posted job today (feed jobs aren't counted).
create or replace function public.record_job_view(p_job text)
returns void language sql security definer set search_path = '' as $$
  insert into public.job_views (job_id, day, views)
  select id, current_date, 1 from public.jobs where id = p_job and posted_by is not null
  on conflict (job_id, day) do update set views = public.job_views.views + 1;
$$;

revoke all on function public.post_job(text, text, text, text, text, text, text, text, text, integer, text[], text, text, text, numeric, numeric, text, text, boolean, jsonb) from public, anon;
revoke all on function public.set_job_status(text, text) from public, anon;
revoke all on function public.apply_to_job(text, text, jsonb, text, jsonb, integer, jsonb, integer) from public, anon;
revoke all on function public.set_application_stage(uuid, text, text) from public, anon;
revoke all on function public.add_application_event(uuid, text, text) from public, anon;
revoke all on function public.withdraw_application(uuid) from public, anon;
revoke all on function public.record_job_view(text) from public, anon;
grant execute on function public.post_job(text, text, text, text, text, text, text, text, text, integer, text[], text, text, text, numeric, numeric, text, text, boolean, jsonb) to authenticated;
grant execute on function public.set_job_status(text, text) to authenticated;
grant execute on function public.apply_to_job(text, text, jsonb, text, jsonb, integer, jsonb, integer) to authenticated;
grant execute on function public.set_application_stage(uuid, text, text) to authenticated;
grant execute on function public.add_application_event(uuid, text, text) to authenticated;
grant execute on function public.withdraw_application(uuid) to authenticated;
grant execute on function public.record_job_view(text) to authenticated;

-- Posters also see their own closed jobs (everyone else sees open jobs only).
drop policy if exists "jobs: poster reads own" on public.jobs;
create policy "jobs: poster reads own" on public.jobs for select to authenticated using (posted_by = (select auth.uid()));
