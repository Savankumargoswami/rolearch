-- Full job description text (plain text, data/ML jobs only) for the ATS check. Run after 006_search.sql.
-- Used for analysis on the server; pages still show the summary and link to the company's own posting.
alter table public.jobs add column if not exists description text not null default '';
