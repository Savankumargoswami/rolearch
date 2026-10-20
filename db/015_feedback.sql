-- Member feedback: which features people like, which they don't, and what they'd add.
-- Run after 014_hiring.sql. Safe to re-run.
-- Members insert and read only their own rows; the weekly digest reads everything through a function
-- that requires the server's secret (the same one the site uses for reviews).

create table if not exists public.feedback (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  account_type  text not null default 'seeker',
  liked         text[] not null default '{}',
  disliked      text[] not null default '{}',
  liked_note    text not null default '' check (length(liked_note) <= 2000),
  disliked_note text not null default '' check (length(disliked_note) <= 2000),
  wishlist      text not null default '' check (length(wishlist) <= 3000),
  rating        smallint check (rating between 1 and 5),
  created_at    timestamptz not null default now()
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);

alter table public.feedback enable row level security;
grant select, insert on public.feedback to authenticated;

drop policy if exists "feedback: add your own" on public.feedback;
create policy "feedback: add your own" on public.feedback for insert to authenticated
  with check (user_id = (select auth.uid()));
drop policy if exists "feedback: read your own" on public.feedback;
create policy "feedback: read your own" on public.feedback for select to authenticated
  using (user_id = (select auth.uid()));

-- Everything sent since a time, for the weekly digest email.
create or replace function public.feedback_since(p_secret text, p_since timestamptz)
returns table (
  id uuid, account_type text, liked text[], disliked text[], liked_note text, disliked_note text,
  wishlist text, rating smallint, created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  return query
    select f.id, f.account_type, f.liked, f.disliked, f.liked_note, f.disliked_note, f.wishlist, f.rating, f.created_at
    from public.feedback as f
    where f.created_at >= p_since
    order by f.created_at;
end;
$$;

revoke all on function public.feedback_since(text, timestamptz) from public;
grant execute on function public.feedback_since(text, timestamptz) to anon, authenticated;
