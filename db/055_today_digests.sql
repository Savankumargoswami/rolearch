-- 055: the public daily-list pages (/today/{topic}) read a saved copy of their digest instead of running
-- jobs_digest (024) on every visit. That live query took 18 to 60 seconds under database load (19 Nov 2026), too slow
-- for Google and for visitors. A scheduled job refreshes the topics twice an hour, oldest first. Run after 024. Safe to re-run.
-- Server-only: the site reads it with the server key.

create table if not exists public.today_digests (
  topic        text primary key,
  digest       jsonb not null,
  refreshed_at timestamptz not null default now()
);
alter table public.today_digests enable row level security;
revoke all on table public.today_digests from anon, authenticated;
grant all on table public.today_digests to service_role;

-- The topics are the ones the site lists (src/lib/daily-post.ts TOPICS); jobs_digest handles each key.
create or replace function private.refresh_today_digests(budget interval default '200 seconds')
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  started timestamptz := clock_timestamp();
  secret text := (select value from private.settings where key = 'post_review_secret');
  since timestamptz := date_trunc('hour', now()) - interval '1 day';
  t text;
  d jsonb;
  done int := 0;
begin
  for t in
    select k from unnest(array['new', 'remote', 'software', 'healthcare', 'visa', 'data', 'pay', 'trades', 'finance',
                               'engineering', 'education', 'sales', 'driving', 'marketing']) as k
    left join public.today_digests as s on s.topic = k
    order by s.refreshed_at asc nulls first
  loop
    exit when clock_timestamp() - started > budget;
    begin
      d := public.jobs_digest(secret, t, since);
      insert into public.today_digests (topic, digest, refreshed_at) values (t, d, now())
      on conflict (topic) do update set digest = excluded.digest, refreshed_at = excluded.refreshed_at;
      done := done + 1;
    exception when others then
      null; -- a slow topic keeps its last copy and is tried first next time
    end;
  end loop;
  return done;
end;
$$;

-- At 20 and 50 past every hour: under load a topic can take a minute, so each run does what fits in its budget and
-- the next run picks up the oldest; every topic is normally refreshed within the hour.
select cron.unschedule('today-digests') where exists (select 1 from cron.job where jobname = 'today-digests');
select cron.schedule('today-digests', '20,50 * * * *', $$set statement_timeout = '5min'; select private.refresh_today_digests()$$);
