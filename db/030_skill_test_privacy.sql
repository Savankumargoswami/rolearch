-- Skill tests: candidates see their score, pass/fail and badge, never the graded questions and answers. Run after
-- 029_skill_tests.sql. Safe to re-run.
--
-- While a test is running, its owner reads the questions through my_skill_test_questions() and their own saved answers
-- (to resume). Once it's graded, the questions, the correct answers, the candidate's answers, the proctoring log and the
-- camera snapshots are readable only by a company the candidate applied to (skill_attempt_review() and the policies below).

-- Only the summary columns are readable directly; questions and results go through the functions below.
revoke select on public.skill_attempts from authenticated;
grant select (id, user_id, skill, level, attempt_no, status, started_at, deadline, submitted_at, score, passed, proctor)
  on public.skill_attempts to authenticated;

-- A company the candidate applied to (not the candidate).
create or replace function public.company_can_view_skills(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.applications a where a.applicant_id = p_user and a.company_id = (select auth.uid()));
$$;
revoke all on function public.company_can_view_skills(uuid) from public, anon;
grant execute on function public.company_can_view_skills(uuid) to authenticated;

-- The candidate's own questions, only while the test is open.
create or replace function public.my_skill_test_questions(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select t.questions from public.skill_attempts t
  where t.id = p_attempt and t.user_id = (select auth.uid()) and t.status = 'in_progress';
$$;
revoke all on function public.my_skill_test_questions(uuid) from public, anon;
grant execute on function public.my_skill_test_questions(uuid) to authenticated;

-- The full graded test, for a company the candidate applied to.
create or replace function public.skill_attempt_review(p_attempt uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object('questions', t.questions, 'results', t.results) from public.skill_attempts t
  where t.id = p_attempt and t.status = 'graded' and public.company_can_view_skills(t.user_id);
$$;
revoke all on function public.skill_attempt_review(uuid) from public, anon;
grant execute on function public.skill_attempt_review(uuid) to authenticated;

-- Saved answers: the owner while the test runs (to resume after a reload); companies once graded.
drop policy if exists "skill answers: candidate or company" on public.skill_answers;
drop policy if exists "skill answers: own while running, or company" on public.skill_answers;
create policy "skill answers: own while running, or company" on public.skill_answers for select to authenticated
  using (exists (select 1 from public.skill_attempts t where t.id = attempt_id
                 and ((t.user_id = (select auth.uid()) and t.status = 'in_progress') or public.company_can_view_skills(t.user_id))));

-- Proctoring log and camera snapshots: companies only.
drop policy if exists "skill events: candidate or company" on public.skill_events;
drop policy if exists "skill events: company" on public.skill_events;
create policy "skill events: company" on public.skill_events for select to authenticated
  using (exists (select 1 from public.skill_attempts t where t.id = attempt_id and public.company_can_view_skills(t.user_id)));

drop policy if exists "proctor: candidate or company read" on storage.objects;
drop policy if exists "proctor: company read" on storage.objects;
create policy "proctor: company read" on storage.objects for select to authenticated
  using (bucket_id = 'proctor' and public.company_can_view_skills(((storage.foldername(name))[1])::uuid));
