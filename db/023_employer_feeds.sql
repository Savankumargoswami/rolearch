-- Employer job feeds: a verified company account connects the job feed its hiring system already produces for job
-- boards (Indeed-style XML, RSS or Atom), and the worker reads it on every refresh. Jobs are always listed under the
-- account's own company. Run after 022_country_search.sql. Safe to re-run.

create table if not exists public.employer_feeds (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users (id) on delete cascade,
  url text not null check (url ~ '^https://' and length(url) <= 2000),
  status text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  job_count integer,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (owner, url)
);
alter table public.employer_feeds enable row level security;
drop policy if exists "employer feeds: owner reads" on public.employer_feeds;
create policy "employer feeds: owner reads" on public.employer_feeds for select to authenticated
  using (owner = (select auth.uid()));
-- Writes only go through the functions below.

-- A verified company account (sign-up email on the company's own domain) connects a feed. p_count is what the
-- site's own check found, shown until the worker's first read.
create or replace function public.add_employer_feed(p_url text, p_count integer)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
  v_profile public.profiles;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not signed in'; end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.account_type is distinct from 'company' then raise exception 'only company accounts can connect a feed'; end if;
  if not v_profile.company_domain_matches then raise exception 'company not verified'; end if;
  if (select count(*) from public.employer_feeds where owner = v_uid) >= 5 then raise exception 'feed limit reached'; end if;
  insert into public.employer_feeds (owner, url, job_count)
  values (v_uid, trim(p_url), p_count)
  on conflict (owner, url) do update set status = 'pending', last_error = null
  returning id into v_id;
  return v_id;
end;
$$;
revoke execute on function public.add_employer_feed(text, integer) from public, anon;
grant execute on function public.add_employer_feed(text, integer) to authenticated;

-- Removing a feed closes the jobs that came from it.
create or replace function public.remove_employer_feed(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  delete from public.employer_feeds where id = p_id and owner = (select auth.uid());
  if found then
    update public.jobs set status = 'closed', closed_at = now()
    where company_key = 'feed:' || p_id::text and status = 'open';
  end if;
end;
$$;
revoke execute on function public.remove_employer_feed(uuid) from public, anon;
grant execute on function public.remove_employer_feed(uuid) to authenticated;
