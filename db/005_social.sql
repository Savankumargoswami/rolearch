-- Follows and posts. Run after 004_avatars.sql. Safe to re-run.

-- ---------- Profiles: signed-in members can see each other's profiles ----------
-- Column grants keep private fields (like resume_file, the stored resume's path) owner-only by never exposing them.
revoke select on public.profiles from anon, authenticated;
grant select (id, account_type, full_name, company_name, website, company_domain_matches, headline, location, status,
              links, resume, avatar_url, created_at, updated_at)
  on public.profiles to authenticated;

drop policy if exists "read own profile" on public.profiles;
drop policy if exists "profiles: members read" on public.profiles;
create policy "profiles: members read" on public.profiles for select to authenticated using (true);

-- ---------- Follows ----------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);
alter table public.follows enable row level security;
grant select, insert, delete on public.follows to authenticated;

drop policy if exists "follows: members read" on public.follows;
create policy "follows: members read" on public.follows for select to authenticated using (true);
drop policy if exists "follows: follow as yourself" on public.follows;
create policy "follows: follow as yourself" on public.follows for insert to authenticated
  with check (follower_id = (select auth.uid()));
drop policy if exists "follows: unfollow as yourself" on public.follows;
create policy "follows: unfollow as yourself" on public.follows for delete to authenticated
  using (follower_id = (select auth.uid()));

-- ---------- Posts ----------
-- Members can read and delete posts, but not insert them directly: every post goes through the
-- review on the server, which then calls publish_post with a secret only the server knows.
create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  kind       text not null check (kind in ('project', 'output', 'resource')),
  body       text not null check (char_length(body) between 1 and 2000),
  link       text not null default '' check (char_length(link) <= 500),
  images     text[] not null default '{}' check (cardinality(images) <= 4),
  review     jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists posts_author_idx on public.posts (author_id, created_at desc);
create index if not exists posts_created_idx on public.posts (created_at desc);
alter table public.posts enable row level security;
revoke all on public.posts from anon, authenticated;
grant select, delete on public.posts to authenticated;

drop policy if exists "posts: members read" on public.posts;
create policy "posts: members read" on public.posts for select to authenticated using (true);
drop policy if exists "posts: delete own" on public.posts;
create policy "posts: delete own" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.settings (key text primary key, value text not null);

create or replace function public.publish_post(p_secret text, p_kind text, p_body text, p_link text, p_images text[], p_review jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not signed in';
  end if;
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'post was not reviewed';
  end if;
  if exists (select 1 from unnest(p_images) as img where split_part(img, '/', 1) <> (select auth.uid())::text) then
    raise exception 'images must be in your own folder';
  end if;
  insert into public.posts (author_id, kind, body, link, images, review)
  values ((select auth.uid()), p_kind, p_body, p_link, coalesce(p_images, '{}'), coalesce(p_review, '{}'))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.publish_post(text, text, text, text, text[], jsonb) from public, anon;
grant execute on function public.publish_post(text, text, text, text, text[], jsonb) to authenticated;

-- ---------- Post images: public to view; members write only to their own folder ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-images', 'post-images', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "post-images: own files read" on storage.objects;
create policy "post-images: own files read" on storage.objects for select to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "post-images: own files upload" on storage.objects;
create policy "post-images: own files upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
drop policy if exists "post-images: own files delete" on storage.objects;
create policy "post-images: own files delete" on storage.objects for delete to authenticated
  using (bucket_id = 'post-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
