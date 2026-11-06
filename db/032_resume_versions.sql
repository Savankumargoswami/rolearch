-- Resume version manager: each tailored resume is kept as its own version (the profile stays the original), with
-- the job it was made for, so people can tailor without losing the original and see which version gets interviews.
-- Run after 031_application_manager.sql. Safe to re-run.

create table if not exists public.resume_versions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  job_id     text not null default '',
  title      text not null default '' check (char_length(title) <= 200),
  company    text not null default '' check (char_length(company) <= 120),
  label      text not null default '' check (char_length(label) <= 120),
  -- The tailored resume (same shape as the ATS check's resume document), and how many edits were accepted/kept.
  doc        jsonb not null,
  accepted   integer not null default 0,
  kept       integer not null default 0,
  created_at timestamptz not null default now(),
  constraint resume_versions_doc_size check (pg_column_size(doc) <= 200000)
);
create index if not exists resume_versions_user_idx on public.resume_versions (user_id, created_at desc);

alter table public.resume_versions enable row level security;
grant select, insert, update, delete on public.resume_versions to authenticated;
drop policy if exists "resume versions: own rows" on public.resume_versions;
create policy "resume versions: own rows" on public.resume_versions for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Which version was sent to each tracked job (for application outcome intelligence).
alter table public.tracked_jobs add column if not exists resume_version uuid references public.resume_versions (id) on delete set null;
