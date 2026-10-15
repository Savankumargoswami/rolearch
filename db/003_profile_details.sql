-- Profile details (the one-page resume) and private resume storage. Run after 002_profiles.sql. Safe to re-run.

alter table public.profiles
  add column if not exists headline    text  not null default '',
  add column if not exists location    text  not null default '',
  add column if not exists status      text  not null default 'professional' check (status in ('student', 'professional')),
  add column if not exists links       jsonb not null default '[]'::jsonb,
  -- experience, education, projects, certifications, skills (shape: src/lib/profile-schema.ts)
  add column if not exists resume      jsonb not null default '{}'::jsonb,
  add column if not exists resume_file text  not null default '';

-- People edit their own details; account_type and the company domain check stay database-only.
grant update (full_name, company_name, website, headline, location, status, links, resume, resume_file, updated_at)
  on public.profiles to authenticated;

-- Resumes: private bucket, each person can only touch files under a folder named with their user id.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('resumes', 'resumes', false, 5242880,
        array['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "resumes: own files read" on storage.objects;
create policy "resumes: own files read" on storage.objects for select to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "resumes: own files upload" on storage.objects;
create policy "resumes: own files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "resumes: own files delete" on storage.objects;
create policy "resumes: own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'resumes' and (storage.foldername(name))[1] = (select auth.uid())::text);
