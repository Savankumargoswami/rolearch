-- Hiring posts: members hiring for their own team post the role; matching members see it first and can say
-- they're interested, which emails the author. Run after 025_live_descriptions.sql. Safe to re-run.

alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('project', 'output', 'resource', 'jobs', 'hiring'));

create table if not exists public.post_interest (
  post_id    uuid not null references public.posts (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists post_interest_user_idx on public.post_interest (user_id);
alter table public.post_interest enable row level security;
revoke all on public.post_interest from anon, authenticated;
grant select, insert, delete on public.post_interest to authenticated;

drop policy if exists "interest: add your own" on public.post_interest;
create policy "interest: add your own" on public.post_interest for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (select 1 from public.posts as p where p.id = post_id and p.kind = 'hiring' and p.author_id <> (select auth.uid())));
drop policy if exists "interest: yours, or on your posts" on public.post_interest;
create policy "interest: yours, or on your posts" on public.post_interest for select to authenticated
  using (user_id = (select auth.uid()) or exists (select 1 from public.posts as p where p.id = post_id and p.author_id = (select auth.uid())));
drop policy if exists "interest: withdraw your own" on public.post_interest;
create policy "interest: withdraw your own" on public.post_interest for delete to authenticated
  using (user_id = (select auth.uid()));

-- The author's address, for the "someone is interested" email; only the server (with its secret) can ask.
create or replace function public.post_author_email(p_secret text, p_post uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  return (select u.email::text from public.posts as p join auth.users as u on u.id = p.author_id where p.id = p_post);
end;
$$;
revoke all on function public.post_author_email(text, uuid) from public;
grant execute on function public.post_author_email(text, uuid) to anon, authenticated;
