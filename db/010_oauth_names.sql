-- Google and GitHub sign-ups: take the person's name from whichever field the provider fills.
-- Run after 009_search_jobs.sql. Safe to re-run. OAuth sign-ups are always job-seeker accounts.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  provider text := coalesce(new.raw_app_meta_data ->> 'provider', 'email');
  kind text := case when provider = 'email' and meta ->> 'account_type' = 'company' then 'company' else 'seeker' end;
  site text := left(coalesce(meta ->> 'website', ''), 200);
  site_host text := lower(regexp_replace(regexp_replace(site, '^https?://', '', 'i'), '^www\.|[/:?#].*$', '', 'gi'));
  email_host text := lower(split_part(coalesce(new.email, ''), '@', 2));
begin
  insert into public.profiles (id, account_type, full_name, company_name, website, company_domain_matches)
  values (
    new.id,
    kind,
    left(coalesce(nullif(meta ->> 'full_name', ''), nullif(meta ->> 'name', ''), nullif(meta ->> 'user_name', ''), ''), 120),
    case when kind = 'company' then left(coalesce(meta ->> 'company_name', ''), 120) else '' end,
    case when kind = 'company' then site else '' end,
    kind = 'company' and site_host <> '' and email_host = site_host
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
