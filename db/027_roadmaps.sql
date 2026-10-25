-- Career roadmaps (one per role, written from O*NET occupation data, CC BY 4.0) and which job titles lead to which
-- roadmap. Run after 026_hiring_posts.sql. Safe to re-run.
-- Roadmaps are members-only: signed-in members read them; visitors and search engines don't. The role list is public.

create table if not exists public.roadmaps (
  slug       text primary key,
  role       text not null,
  soc        text not null,
  depth      text not null default 'short' check (depth in ('short', 'deep')),
  summary    text not null default '',
  data       jsonb not null,
  updated_at timestamptz not null default now()
);
create index if not exists roadmaps_soc_idx on public.roadmaps (soc);
alter table public.roadmaps enable row level security;
revoke all on public.roadmaps from anon, authenticated;
grant select on public.roadmaps to authenticated;
drop policy if exists "roadmaps: members read" on public.roadmaps;
create policy "roadmaps: members read" on public.roadmaps for select to authenticated using (true);

-- The public list of roles (name, summary, depth) for the roadmaps index; the roadmap itself stays members-only.
create or replace function public.roadmap_list()
returns table (slug text, role text, summary text, depth text)
language sql
stable
security definer
set search_path = ''
as $$ select r.slug, r.role, r.summary, r.depth from public.roadmaps as r order by r.role; $$;
revoke all on function public.roadmap_list() from public;
grant execute on function public.roadmap_list() to anon, authenticated;

-- Normalised job title ("registered nurse", "rn", "software engineer") -> roadmap slug.
create table if not exists public.role_titles (
  title text primary key,
  slug  text not null references public.roadmaps (slug) on delete cascade
);
alter table public.role_titles enable row level security;
revoke all on public.role_titles from anon, authenticated;
grant select on public.role_titles to anon, authenticated;
drop policy if exists "role titles are public" on public.role_titles;
create policy "role titles are public" on public.role_titles for select to anon, authenticated using (true);
