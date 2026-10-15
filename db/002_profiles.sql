-- Accounts: one profile per Supabase Auth user, created automatically on sign-up.
-- Run after schema.sql. Safe to re-run.

create table if not exists public.profiles (
  id                     uuid primary key references auth.users (id) on delete cascade,
  account_type           text not null default 'seeker' check (account_type in ('seeker', 'company')),
  full_name              text not null default '',
  company_name           text not null default '',
  website                text not null default '',
  -- Set by the database, never by the client: does the sign-up email's domain match the company website?
  company_domain_matches boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "read own profile" on public.profiles;
create policy "read own profile" on public.profiles for select to authenticated using ((select auth.uid()) = id);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles for update to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

-- People may edit their name and company details, but not the account type or the domain check.
revoke update on public.profiles from authenticated;
grant update (full_name, company_name, website, updated_at) on public.profiles to authenticated;

-- Create the profile from the sign-up form's metadata. security definer so it can write past RLS;
-- empty search_path so it can't be tricked into using another schema's objects.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  kind text := case when meta ->> 'account_type' = 'company' then 'company' else 'seeker' end;
  site text := left(coalesce(meta ->> 'website', ''), 200);
  site_host text := lower(regexp_replace(regexp_replace(site, '^https?://', '', 'i'), '^www\.|[/:?#].*$', '', 'gi'));
  email_host text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  insert into public.profiles (id, account_type, full_name, company_name, website, company_domain_matches)
  values (
    new.id,
    kind,
    left(coalesce(meta ->> 'full_name', ''), 120),
    case when kind = 'company' then left(coalesce(meta ->> 'company_name', ''), 120) else '' end,
    case when kind = 'company' then site else '' end,
    kind = 'company' and site_host <> '' and email_host = site_host
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
