-- Descriptions the ATS check reads live from the employer's posting, kept with the job. Run after 024_daily_posts.sql. Safe to re-run.
-- Only the server (with its secret) can save one, only for an open job, and never over a longer stored description.
create or replace function public.save_job_description(p_secret text, p_id text, p_description text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_secret is null or p_secret is distinct from (select value from private.settings where key = 'post_review_secret') then
    raise exception 'not allowed';
  end if;
  update public.jobs set description = left(p_description, 20000)
  where id = p_id and status = 'open' and length(coalesce(description, '')) < length(coalesce(p_description, ''));
  return found;
end;
$$;
revoke all on function public.save_job_description(text, text, text) from public;
grant execute on function public.save_job_description(text, text, text) to anon, authenticated;
