-- QA fixes (Nov 2026 QA report). Safe to run more than once.
--
-- BUG-002  Members could delete their own ai_usage rows through the API and reset their AI limits.
--          Supabase's default privileges gave authenticated full table rights, so the 034 grant (select, insert)
--          never limited delete/update. Members may now only read and add their own usage rows.
-- BUG-005  "Hide my profile": hidden members drop out of member search, recruiter talent search and their
--          profile page for everyone else (employers they applied to still see the application's own copy).
-- BUG-011  kpi_metrics / validation_metrics are views with no grants; make them run with the caller's rights
--          so they can never expose more than the caller could see directly.
-- BUG-029  US jobs in "Georgia" (the state) were stored as the country Georgia and listed under Europe.

-- ---------- BUG-002: AI usage rows can't be removed or edited by members ----------
revoke update, delete, truncate, references, trigger on public.ai_usage from authenticated, anon;
revoke all on public.ai_usage from anon;
grant select, insert on public.ai_usage to authenticated;
drop policy if exists "ai usage: own rows" on public.ai_usage;
drop policy if exists "ai usage: read own" on public.ai_usage;
drop policy if exists "ai usage: add own" on public.ai_usage;
create policy "ai usage: read own" on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));
create policy "ai usage: add own" on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));

-- ---------- BUG-005: hide my profile ----------
alter table public.profiles add column if not exists hidden boolean not null default false;
grant select (hidden) on public.profiles to authenticated;

create or replace function public.set_profile_hidden(p_hidden boolean)
returns void language sql security definer set search_path = '' as $$
  update public.profiles set hidden = coalesce(p_hidden, false), updated_at = now() where id = (select auth.uid());
$$;
revoke all on function public.set_profile_hidden(boolean) from public, anon;
grant execute on function public.set_profile_hidden(boolean) to authenticated;

create or replace function public.search_profiles(q text, lim integer default 20)
returns table (id uuid, full_name text, company_name text, headline text, location text, avatar_url text, account_type text, skills text[], score integer)
language sql
stable
security invoker
set search_path = ''
as $$
  with input as (
    select lower(trim(coalesce(q, ''))) as phrase,
           array(select t from unnest(regexp_split_to_array(lower(trim(coalesce(q, ''))), '\s+')) as t where t <> '') as terms
  ),
  people as (
    select pr.id, pr.full_name, pr.company_name, pr.headline, pr.location, pr.avatar_url, pr.account_type,
           array(select s from jsonb_array_elements_text(case when jsonb_typeof(pr.resume -> 'skills') = 'array' then pr.resume -> 'skills' else '[]'::jsonb end) as s) as skills,
           lower(concat_ws(' ',
             pr.full_name, pr.company_name, pr.headline, pr.location,
             (select string_agg(concat_ws(' ', e ->> 'title', e ->> 'company'), ' ')
                from jsonb_array_elements(case when jsonb_typeof(pr.resume -> 'experience') = 'array' then pr.resume -> 'experience' else '[]'::jsonb end) as e),
             (select string_agg(s, ' ')
                from jsonb_array_elements_text(case when jsonb_typeof(pr.resume -> 'skills') = 'array' then pr.resume -> 'skills' else '[]'::jsonb end) as s)
           )) as hay
    from public.profiles as pr
    where (pr.full_name <> '' or pr.company_name <> '')
      and (not pr.hidden or pr.id = (select auth.uid()))
  )
  select p.id, p.full_name, p.company_name, p.headline, p.location, p.avatar_url, p.account_type, p.skills[1:6],
         (case when strpos(lower(p.full_name), i.phrase) = 1 or strpos(lower(p.company_name), i.phrase) = 1 then 8
               when strpos(lower(p.full_name), i.phrase) > 0 or strpos(lower(p.company_name), i.phrase) > 0 then 6
               when strpos(lower(p.headline), i.phrase) > 0 then 4
               when exists (select 1 from unnest(p.skills) as s where lower(s) = i.phrase) then 3
               else 1 end) as score
  from people as p, input as i
  where cardinality(i.terms) > 0
    and (select bool_and(strpos(p.hay, t) > 0) from unnest(i.terms) as t)
  order by score desc, p.full_name
  limit least(greatest(coalesce(lim, 20), 1), 50);
$$;
revoke all on function public.search_profiles(text, integer) from public, anon;
grant execute on function public.search_profiles(text, integer) to authenticated;

-- talent_search: same as db/035 plus "and not p.hidden".
do $do$
declare v_def text;
begin
  select pg_get_functiondef('public.talent_search(text, integer)'::regprocedure) into v_def;
  if v_def is not null and v_def not like '%not p.hidden%' then
    v_def := replace(v_def, 'where p.open_to_work', 'where p.open_to_work and not p.hidden');
    execute v_def;
  end if;
end
$do$;

-- ---------- BUG-011: metric views run with the caller's rights ----------
do $do$
begin
  if to_regclass('public.kpi_metrics') is not null then execute 'alter view public.kpi_metrics set (security_invoker = true)'; end if;
  if to_regclass('public.validation_metrics') is not null then execute 'alter view public.validation_metrics set (security_invoker = true)'; end if;
end
$do$;

-- ---------- BUG-029: US jobs stored as the country Georgia ----------
-- Keeps real jobs in the country Georgia (Tbilisi, Batumi, Kutaisi, ...). Only touches rows with country = 'Georgia'.
update public.jobs
set country = 'United States', country_code = 'US', region = 'north-america'
where country = 'Georgia'
  and coalesce(lower(city), '') not in ('tbilisi', 'batumi', 'kutaisi', 'rustavi', 'zugdidi', 'gori', 'poti');
