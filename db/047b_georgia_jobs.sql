-- QA fixes, part 2 of 2 (BUG-029): open US jobs in "Georgia" (the state) were stored as the country Georgia and listed
-- under Europe. Uses the open-jobs region index (jobs_region_idx), so it touches only open European rows instead of
-- scanning every job. Keeps real jobs in the country Georgia (Tbilisi, Batumi, ...). Safe to run more than once.
update public.jobs
set country = 'United States', country_code = 'US', region = 'north-america'
where status = 'open'
  and region = 'europe'
  and country = 'Georgia'
  and coalesce(lower(city), '') not in ('tbilisi', 'batumi', 'kutaisi', 'rustavi', 'zugdidi', 'gori', 'poti');
