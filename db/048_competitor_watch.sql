-- Competitor watch (src/app/api/cron/competitor-watch): each week's research notes per competitor, so the next run can
-- tell what is new. Server-only: no policies, and the public roles get no access (read and written with the data key).
create table if not exists public.competitor_watch (
  week date not null,
  competitor text not null,
  notes jsonb not null,
  created_at timestamptz not null default now(),
  primary key (week, competitor)
);

alter table public.competitor_watch enable row level security;
revoke all on public.competitor_watch from anon, authenticated;
