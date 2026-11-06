-- AI application manager: deadlines, interviews, recruiter contacts and conversations, follow-ups and rejection
-- reasons on each tracked job. Run after 014_hiring.sql. Safe to re-run. The tracker's existing row-level policy
-- ("own rows") and table grants cover the new columns.

alter table public.tracked_jobs
  add column if not exists deadline         date,
  add column if not exists interview_at     timestamptz,
  add column if not exists follow_up_on     date,
  add column if not exists contact_name     text not null default '',
  add column if not exists contact_email    text not null default '',
  add column if not exists rejection_reason text not null default '',
  -- Recruiter conversations and other events, newest last: [{ "at": "2026-11-06", "kind": "email", "text": "..." }]
  add column if not exists log              jsonb not null default '[]'::jsonb;

alter table public.tracked_jobs drop constraint if exists tracked_jobs_rejection_reason_check;
alter table public.tracked_jobs add constraint tracked_jobs_rejection_reason_check
  check (rejection_reason in ('', 'no_response', 'skills_gap', 'experience', 'location', 'salary', 'position_filled', 'after_interview', 'other'));

alter table public.tracked_jobs drop constraint if exists tracked_jobs_log_size_check;
alter table public.tracked_jobs add constraint tracked_jobs_log_size_check check (jsonb_array_length(log) <= 200);
