-- Profile photos. Run after 003_profile_details.sql. Safe to re-run.

alter table public.profiles add column if not exists avatar_url text not null default '';
grant update (avatar_url) on public.profiles to authenticated;

-- Photos are public (shown on profiles); only the owner can add, replace or delete theirs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "avatars: own files read" on storage.objects;
create policy "avatars: own files read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: own files upload" on storage.objects;
create policy "avatars: own files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "avatars: own files delete" on storage.objects;
create policy "avatars: own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
