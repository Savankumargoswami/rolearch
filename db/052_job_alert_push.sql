-- 052: job alerts as phone/desktop notifications (web push). A member turns them on per device from their account
-- page; once a day the site checks each member's first target role for jobs posted in the last day and, if there are
-- any, sends "12 new Data Analyst jobs" to that member's devices.
-- A subscription is the browser's push address (endpoint) and its two encryption keys: no message content is stored.
-- Safe to re-run.

create table if not exists public.push_subscriptions (
  endpoint     text primary key check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  user_id      uuid not null references auth.users (id) on delete cascade,
  p256dh       text not null check (length(p256dh) <= 200),
  auth         text not null check (length(auth) <= 100),
  created_at   timestamptz not null default now(),
  last_sent_at timestamptz
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
revoke all on public.push_subscriptions from anon, authenticated;
grant select, insert, delete on public.push_subscriptions to authenticated;

-- Members see, add and remove only their own devices.
drop policy if exists "push: read own" on public.push_subscriptions;
create policy "push: read own" on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "push: add own" on public.push_subscriptions;
create policy "push: add own" on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
drop policy if exists "push: remove own" on public.push_subscriptions;
create policy "push: remove own" on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- For the daily send (server only): every device, with its member's first target role.
create or replace function public.push_recipients(p_secret text)
returns table (endpoint text, p256dh text, auth text, target_role text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  return query
    select s.endpoint, s.p256dh, s.auth,
           nullif(trim(coalesce(p.preferences -> 'targetRoles' ->> 0, p.preferences -> 'target_roles' ->> 0, '')), '')
    from public.push_subscriptions s
    left join public.profiles p on p.id = s.user_id;
end;
$$;
revoke all on function public.push_recipients(text) from public, anon, authenticated;
grant execute on function public.push_recipients(text) to service_role;

-- After a send: drop devices the push service says are gone (uninstalled, permission revoked), stamp the rest.
create or replace function public.push_sent(p_secret text, p_sent text[], p_gone text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  delete from public.push_subscriptions where endpoint = any (coalesce(p_gone, '{}'));
  update public.push_subscriptions set last_sent_at = now() where endpoint = any (coalesce(p_sent, '{}'));
end;
$$;
revoke all on function public.push_sent(text, text[], text[]) from public, anon, authenticated;
grant execute on function public.push_sent(text, text[], text[]) to service_role;
