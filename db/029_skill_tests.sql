-- Skill tests and badges. Run after 028_sitemap_described_jobs.sql. Safe to re-run.
--
-- The grading service (Railway) generates each person's test and grades it through DATABASE_URL, so only it can write
-- attempts, results and badges, and only it can read the answer keys in private.skill_test_keys. Browsers read their own
-- attempts through RLS, and save answers and proctoring events only through the security definer functions below, which
-- check the caller, the attempt's status and its deadline. A company can read the attempts of people who applied to it.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- ---------- Attempts: what the candidate sees, plus the graded result ----------
create table if not exists public.skill_attempts (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users (id) on delete cascade,
  skill        text not null,
  level        text not null check (level in ('entry', 'mid', 'senior', 'very_senior')),
  attempt_no   integer not null,
  status       text not null default 'in_progress' check (status in ('in_progress', 'graded', 'expired')),
  questions    jsonb not null,               -- what the candidate sees: no answers, no hidden tests
  started_at   timestamptz not null default now(),
  deadline     timestamptz not null,
  submitted_at timestamptz,
  score        numeric(5, 2),                -- percent
  passed       boolean,
  results      jsonb,                        -- per question: {points, max, correct, answer, why, tests_passed, tests_total}
  proctor      jsonb not null default '{}',  -- summary counts written at grading
  unique (user_id, skill, level, attempt_no)
);
create index if not exists skill_attempts_user_idx on public.skill_attempts (user_id, skill, level, started_at desc);

-- One answer per question, saved as the candidate works (text: an option, code, a formula, a number).
create table if not exists public.skill_answers (
  attempt_id uuid not null references public.skill_attempts (id) on delete cascade,
  q_index    integer not null,
  answer     text not null default '',
  updated_at timestamptz not null default now(),
  primary key (attempt_id, q_index)
);

-- Proctoring log: tab switches, leaving full screen, paste attempts, camera snapshots, camera off.
create table if not exists public.skill_events (
  id         bigint generated always as identity primary key,
  attempt_id uuid not null references public.skill_attempts (id) on delete cascade,
  kind       text not null check (kind in ('blur', 'hidden', 'fullscreen_exit', 'paste', 'copy', 'contextmenu', 'snapshot', 'camera_off', 'resize', 'devtools')),
  detail     text not null default '',
  at         timestamptz not null default now()
);
create index if not exists skill_events_attempt_idx on public.skill_events (attempt_id, at);

-- Badges: one row per passed skill and level. Public, so profiles can show them.
create table if not exists public.skill_badges (
  user_id    uuid not null references auth.users (id) on delete cascade,
  skill      text not null,
  level      text not null,
  attempt_id uuid not null references public.skill_attempts (id) on delete cascade,
  score      numeric(5, 2) not null,
  awarded_at timestamptz not null default now(),
  primary key (user_id, skill, level)
);

-- Service-only: the full generated test with answers and hidden tests, and every question a person has already seen
-- (so a retry is an entirely new set).
create table if not exists private.skill_test_keys (
  attempt_id uuid primary key references public.skill_attempts (id) on delete cascade,
  test       jsonb not null
);
create table if not exists private.skill_seen (
  user_id uuid not null references auth.users (id) on delete cascade,
  skill   text not null,
  fp      text not null,
  primary key (user_id, skill, fp)
);

alter table public.skill_attempts enable row level security;
alter table public.skill_answers enable row level security;
alter table public.skill_events enable row level security;
alter table public.skill_badges enable row level security;

grant select on public.skill_attempts, public.skill_answers, public.skill_events to authenticated;
grant select on public.skill_badges to anon, authenticated;

-- The candidate, or a company the candidate applied to.
create or replace function public.can_view_skill_attempt(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user = (select auth.uid())
      or exists (select 1 from public.applications a where a.applicant_id = p_user and a.company_id = (select auth.uid()));
$$;
revoke all on function public.can_view_skill_attempt(uuid) from public, anon;
grant execute on function public.can_view_skill_attempt(uuid) to authenticated;

drop policy if exists "skill attempts: candidate or company" on public.skill_attempts;
create policy "skill attempts: candidate or company" on public.skill_attempts for select to authenticated
  using (public.can_view_skill_attempt(user_id));

drop policy if exists "skill answers: candidate or company" on public.skill_answers;
create policy "skill answers: candidate or company" on public.skill_answers for select to authenticated
  using (exists (select 1 from public.skill_attempts t where t.id = attempt_id and public.can_view_skill_attempt(t.user_id)));

drop policy if exists "skill events: candidate or company" on public.skill_events;
create policy "skill events: candidate or company" on public.skill_events for select to authenticated
  using (exists (select 1 from public.skill_attempts t where t.id = attempt_id and public.can_view_skill_attempt(t.user_id)));

drop policy if exists "skill badges: public" on public.skill_badges;
create policy "skill badges: public" on public.skill_badges for select to anon, authenticated using (true);

-- ---------- Writes from the browser ----------
create or replace function public.save_skill_answer(p_attempt uuid, p_index integer, p_answer text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.skill_attempts
                 where id = p_attempt and user_id = (select auth.uid()) and status = 'in_progress'
                   and now() <= deadline + interval '30 seconds') then
    raise exception 'this test is closed';
  end if;
  if p_index < 0 or p_index > 100 or length(p_answer) > 20000 then
    raise exception 'answer rejected';
  end if;
  insert into public.skill_answers (attempt_id, q_index, answer, updated_at)
  values (p_attempt, p_index, p_answer, now())
  on conflict (attempt_id, q_index) do update set answer = excluded.answer, updated_at = now();
end;
$$;
revoke all on function public.save_skill_answer(uuid, integer, text) from public, anon;
grant execute on function public.save_skill_answer(uuid, integer, text) to authenticated;

create or replace function public.log_skill_event(p_attempt uuid, p_kind text, p_detail text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.skill_attempts where id = p_attempt and user_id = (select auth.uid()) and status = 'in_progress') then
    return;  -- events after the test closes are ignored
  end if;
  if (select count(*) from public.skill_events where attempt_id = p_attempt) >= 2000 then
    return;
  end if;
  insert into public.skill_events (attempt_id, kind, detail) values (p_attempt, p_kind, left(coalesce(p_detail, ''), 300));
end;
$$;
revoke all on function public.log_skill_event(uuid, text, text) from public, anon;
grant execute on function public.log_skill_event(uuid, text, text) to authenticated;

-- ---------- Camera snapshots: private bucket, one folder per person ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('proctor', 'proctor', false, 262144, array['image/jpeg'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "proctor: own upload" on storage.objects;
create policy "proctor: own upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'proctor' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "proctor: candidate or company read" on storage.objects;
create policy "proctor: candidate or company read" on storage.objects for select to authenticated
  using (bucket_id = 'proctor' and public.can_view_skill_attempt(((storage.foldername(name))[1])::uuid));
