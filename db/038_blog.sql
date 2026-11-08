-- The Rolearch blog: researched articles on the skills each industry is hiring for, published every other day by
-- the blog cron (src/app/api/cron/blog), and email updates for readers who opt in. Run after 037. Safe to re-run.
--
-- Posts are public reading. Only the server (service_role) writes them. Subscribers are server-only: nobody can
-- read or list emails with the public key; sign-up, confirm and unsubscribe all go through the server.

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 90),
  title text not null check (length(title) between 10 and 140),
  description text not null check (length(description) between 40 and 320),
  industry text not null,
  body text not null check (length(body) between 1500 and 40000),
  key_points jsonb not null default '[]',
  faq jsonb not null default '[]',
  sources jsonb not null default '[]',
  skills jsonb not null default '[]',
  reading_minutes int not null default 6,
  published_at timestamptz not null default now(),
  emailed_at timestamptz
);
create index if not exists blog_posts_published on public.blog_posts (published_at desc);
create index if not exists blog_posts_industry on public.blog_posts (industry, published_at desc);

alter table public.blog_posts enable row level security;
revoke all on table public.blog_posts from anon, authenticated;
grant select on table public.blog_posts to anon, authenticated;
grant all on table public.blog_posts to service_role;
drop policy if exists "blog posts are public" on public.blog_posts;
create policy "blog posts are public" on public.blog_posts for select to anon, authenticated using (published_at <= now());

create table if not exists public.blog_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique check (email = lower(email) and length(email) <= 254 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  industry text not null default 'all',
  token uuid not null unique default gen_random_uuid(),
  confirmed boolean not null default false,
  unsubscribed boolean not null default false,
  confirm_sent_at timestamptz,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz
);

alter table public.blog_subscribers enable row level security;
revoke all on table public.blog_subscribers from anon, authenticated;
grant all on table public.blog_subscribers to service_role;
