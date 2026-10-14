-- Rolearch job feed schema (Supabase / Postgres 15+).
-- Run once in the Supabase SQL editor. The worker writes with the service-role
-- connection (bypasses RLS); the website reads open jobs with the anon key.

create table if not exists companies (
  key            text primary key,           -- "<ats>:<token>", e.g. "greenhouse:stripe"
  name           text not null,
  country        char(2) not null,           -- HQ country, used when a job has no country
  ats            text not null,
  token          text not null,
  careers_url    text not null default '',
  active         boolean not null default true,
  last_run_at    timestamptz,
  last_ok_at     timestamptz,
  last_job_count integer,
  last_error     text
);

create table if not exists jobs (
  id              text primary key,          -- readable + stable: company-title-hash
  company_key     text not null references companies(key) on delete cascade,
  dedupe_key      text not null,
  title           text not null,
  company         text not null,
  city            text not null default '',
  country         text not null default '',
  country_code    char(2),
  region          text not null,             -- europe | north-america | latin-america | asia-pacific | india | middle-east-africa | global
  workplace       text not null check (workplace in ('remote', 'hybrid', 'onsite')),
  visa            boolean not null default false,
  salary_min      numeric,
  salary_max      numeric,
  salary_currency text,
  salary_period   text check (salary_period in ('year', 'month', 'hour')),
  level           text not null check (level in ('entry', 'mid', 'senior', 'lead')),
  years           integer not null default 0,
  skills          text[] not null default '{}',
  summary         text not null default '',
  department      text not null default '',
  job_url         text not null,             -- the job's page on the company's careers site
  apply_url       text not null,             -- where Apply sends the person
  source          text not null,
  launch_field    boolean not null default false,
  lat             double precision,
  lon             double precision,
  posted_at       timestamptz,
  first_seen_at   timestamptz not null default now(),
  last_seen_at    timestamptz not null default now(),
  status          text not null default 'open' check (status in ('open', 'closed')),
  closed_at       timestamptz
);

create index if not exists jobs_open_idx on jobs (status, launch_field, posted_at desc);
create index if not exists jobs_region_idx on jobs (region) where status = 'open';
create index if not exists jobs_company_idx on jobs (company_key, status);
create index if not exists jobs_skills_idx on jobs using gin (skills);

alter table companies enable row level security;
alter table jobs enable row level security;

-- Anyone may read open jobs. No public policy on companies; no public writes anywhere.
drop policy if exists "open jobs are public" on jobs;
create policy "open jobs are public" on jobs for select to anon, authenticated using (status = 'open');
