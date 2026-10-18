-- People search. Run after 005_social.sql. Safe to re-run.
-- Runs with the caller's own rights (security invoker), so profile privacy rules still apply:
-- only signed-in members can search, and only the columns they can already read are used.

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
    where pr.full_name <> '' or pr.company_name <> ''
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
