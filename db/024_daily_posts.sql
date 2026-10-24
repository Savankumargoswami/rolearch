-- Daily Rolearch posts and the weekly newsletter. Run after 023_employer_feeds.sql. Safe to re-run.
--   * Official posts have no member author (author_id is null) and kind 'jobs'; the site shows them as "Rolearch".
--     Only the server can publish them, through publish_rolearch_post with its secret.
--   * jobs_digest summarises recent US jobs for one topic (new, remote, visa, pay, or a category), walking the
--     posted_at indexes so it never scans every open job.
--   * Members opt in to the weekly email on their account page; each row has a token for one-click unsubscribe.

alter table public.posts alter column author_id drop not null;
alter table public.posts drop constraint if exists posts_kind_check;
alter table public.posts add constraint posts_kind_check check (kind in ('project', 'output', 'resource', 'jobs'));

create or replace function public.publish_rolearch_post(p_secret text, p_body text, p_link text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  insert into public.posts (author_id, kind, body, link) values (null, 'jobs', p_body, coalesce(p_link, ''))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.publish_rolearch_post(text, text, text) from public;
grant execute on function public.publish_rolearch_post(text, text, text) to anon, authenticated;

-- Recent open US jobs for one topic: how many, from how many employers, a few picks from different employers,
-- the most requested skills and the busiest cities. Reads at most the newest 20,000 matches.
create or replace function public.jobs_digest(p_secret text, p_topic text, p_since timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
set statement_timeout = '60s'
as $$
declare
  v jsonb;
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  with recent as (
    select j.id, j.title, j.company, j.city, j.workplace, j.skills, j.salary_min, j.salary_max, j.salary_period, j.posted_at
    from public.jobs as j
    where j.status = 'open' and j.posted_at >= p_since and j.posted_at <= now() and j.country_code = 'US'
      and case p_topic
            when 'new' then true
            when 'remote' then j.workplace = 'remote'
            when 'visa' then j.visa
            when 'pay' then j.salary_min is not null and j.salary_period = 'year'
            else j.category = p_topic
          end
    order by j.posted_at desc nulls last
    limit 20000
  ),
  picks as (
    select * from (
      select distinct on (lower(r.company)) r.*
      from recent as r
      where char_length(r.title) <= 70
      order by lower(r.company), r.salary_max desc nulls last, r.posted_at desc
    ) as d
    order by case when p_topic = 'pay' then d.salary_max end desc nulls last, (d.salary_min is not null) desc, d.posted_at desc
    limit 6
  )
  select jsonb_build_object(
    'total', (select count(*) from recent),
    'companies', (select count(distinct lower(company)) from recent),
    'jobs', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'title', p.title, 'company', p.company, 'city', p.city,
                       'workplace', p.workplace, 'salary_min', p.salary_min, 'salary_max', p.salary_max, 'salary_period', p.salary_period))
                      from picks as p), '[]'),
    'skills', coalesce((select jsonb_agg(s.skill order by s.n desc)
                        from (select skill, count(*) as n from recent, unnest(recent.skills) as skill
                              group by skill order by n desc limit 8) as s), '[]'),
    'cities', coalesce((select jsonb_agg(c.city order by c.n desc)
                        from (select initcap(lower(city)) as city, count(*) as n from recent
                              where city <> '' and city <> 'Remote' and workplace <> 'remote'
                              group by 1 order by n desc limit 5) as c), '[]')
  ) into v;
  return v;
end;
$$;
revoke all on function public.jobs_digest(text, text, timestamptz) from public;
grant execute on function public.jobs_digest(text, text, timestamptz) to anon, authenticated;

-- ---------- Weekly newsletter ----------
create table if not exists public.newsletter (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  subscribed boolean not null default true,
  category   text not null default 'all',
  token      uuid not null default gen_random_uuid() unique,
  updated_at timestamptz not null default now()
);
alter table public.newsletter enable row level security;
revoke all on public.newsletter from anon, authenticated;
grant select on public.newsletter to authenticated;
grant insert (user_id, subscribed, category, updated_at), update (subscribed, category, updated_at) on public.newsletter to authenticated;

drop policy if exists "newsletter: own row" on public.newsletter;
create policy "newsletter: own row" on public.newsletter for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Everyone subscribed, with the address to send to, for the weekly email.
create or replace function public.newsletter_recipients(p_secret text)
returns table (email text, category text, token uuid)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  return query
    select u.email::text, n.category, n.token
    from public.newsletter as n join auth.users as u on u.id = n.user_id
    where n.subscribed and u.email is not null and u.email_confirmed_at is not null;
end;
$$;
revoke all on function public.newsletter_recipients(text) from public;
grant execute on function public.newsletter_recipients(text) to anon, authenticated;

-- One-click unsubscribe from the link in the email; the token is the only key needed.
create or replace function public.newsletter_unsubscribe(p_token uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  with u as (update public.newsletter set subscribed = false, updated_at = now() where token = p_token returning 1)
  select exists (select 1 from u);
$$;
revoke all on function public.newsletter_unsubscribe(uuid) from public;
grant execute on function public.newsletter_unsubscribe(uuid) to anon, authenticated;
