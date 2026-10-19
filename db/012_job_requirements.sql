-- What each job asks for (skills, tools, certifications, years, education), read once from its
-- description and reused for every visitor's match. Run after 011_job_map.sql. Safe to re-run.
alter table public.jobs add column if not exists requirements jsonb;

-- Only the server (which holds the secret) can store requirements; visitors can't write to jobs.
create or replace function public.save_job_requirements(p_secret text, p_id text, p_requirements jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  update public.jobs set requirements = p_requirements where id = p_id;
end;
$$;

revoke all on function public.save_job_requirements(text, text, jsonb) from public;
grant execute on function public.save_job_requirements(text, text, jsonb) to anon, authenticated;
