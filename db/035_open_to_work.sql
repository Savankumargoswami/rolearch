-- Open to work (passive recruiting) and private preferences. Run after 034_jobfit_reliability.sql. Safe to re-run.
--
-- 1. Job preferences (db/034) are private: members read their own through my_preferences(); no column grant, so
--    other members can't see someone's target roles, locations or experience range.
-- 2. Open to work is opt-in. Only verified company accounts (sign-up email on the company's own domain) can search
--    members who switched it on, and they get professional profile fields only: no email, phone or resume file.

create or replace function public.my_preferences() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(preferences, '{}'::jsonb) from public.profiles where id = (select auth.uid());
$$;
revoke all on function public.my_preferences() from public, anon;
grant execute on function public.my_preferences() to authenticated;

alter table public.profiles
  add column if not exists open_to_work    boolean not null default false,
  add column if not exists open_to_work_at timestamptz;
grant update (open_to_work, open_to_work_at) on public.profiles to authenticated;
grant select (open_to_work) on public.profiles to authenticated;

-- Talent search for verified employers. p_query matches headline, skills and target roles (case-insensitive).
create or replace function public.talent_search(p_query text default '', p_limit integer default 40)
returns table (
  id uuid, full_name text, headline text, location text, avatar_url text,
  target_roles jsonb, work_mode text, skills jsonb, badges integer, open_since timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_ok boolean;
  v_q text := lower(trim(coalesce(p_query, '')));
begin
  select (me.account_type = 'company' and me.company_domain_matches) into v_ok from public.profiles me where me.id = (select auth.uid());
  if not coalesce(v_ok, false) then
    raise exception 'verified company accounts only';
  end if;
  return query
    select p.id, p.full_name, p.headline, p.location, p.avatar_url,
           coalesce(p.preferences -> 'target_roles', '[]'::jsonb),
           coalesce(p.preferences ->> 'work_mode', 'any'),
           coalesce(p.resume -> 'skills', '[]'::jsonb),
           (select count(*)::integer from public.skill_badges b where b.user_id = p.id),
           p.open_to_work_at
    from public.profiles p
    where p.open_to_work
      and p.account_type = 'seeker'
      and (v_q = ''
           or lower(p.headline) like '%' || v_q || '%'
           or lower(coalesce(p.resume ->> 'skills', '')) like '%' || v_q || '%'
           or lower(coalesce(p.preferences ->> 'target_roles', '')) like '%' || v_q || '%')
    order by 9 desc, p.open_to_work_at desc nulls last
    limit least(greatest(coalesce(p_limit, 40), 1), 100);
end;
$$;
revoke all on function public.talent_search(text, integer) from public, anon;
grant execute on function public.talent_search(text, integer) to authenticated;
