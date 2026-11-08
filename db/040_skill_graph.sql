-- Skill relationship data: which skills each role needs, and which roles share them, measured from Rolearch's own
-- live jobs across every industry. Run after 039. Safe to re-run. Needs the pg_cron extension (step 0).
--
-- What it does:
--   1. One skill dictionary (194 skills, every industry), the same one the job worker uses (worker/.../skills.json).
--   2. Tags every job with its career role (jobs.role_slug, from role_titles), on insert and by backfill.
--   3. Backfill: re-tags existing open jobs' skills from their stored description, about 25 seconds of work every
--      2 minutes until done, so the database never gets a heavy burst. Progress: select * from private.skill_backfill;
--   4. Nightly: role_skill_stats (skills per role, how distinctive) and role_links (roles that share skills).
-- Everything is server-only: the public key can't read any of it.

-- 0. Scheduler (Supabase: also in Database > Extensions > pg_cron).
create extension if not exists pg_cron;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- 1. Skill dictionary ---------------------------------------------------------------------------------------------
create table if not exists private.skill_patterns (
  name text primary key,
  cs   text,  -- matched by case (acronyms: RN, CDL, GAAP)
  ci   text   -- matched ignoring case
);

-- The skills a text mentions, most-mentioned first, at most 12 (same rule as the worker's extract_skills).
create or replace function private.extract_skills(p_text text)
returns text[]
language sql
stable
set search_path = ''
as $$
  select coalesce(array_agg(name order by n desc, name), '{}')
  from (
    select p.name,
           coalesce(regexp_count(p_text, p.cs), 0) + coalesce(regexp_count(p_text, p.ci, 1, 'i'), 0) as n
    from private.skill_patterns as p
  ) as m
  where n > 0
$$;

-- At most 12, like the worker.
create or replace function private.top_skills(p_text text)
returns text[]
language sql
stable
set search_path = ''
as $$ select (private.extract_skills(p_text))[1:12] $$;

-- 2. Role tagging -------------------------------------------------------------------------------------------------
-- Same clean-up as normalTitle() in src/lib/roadmaps.ts: no seniority, shift or schedule words, no place after a dash.
create or replace function private.normal_title(p_title text)
returns text
language sql
immutable
set search_path = ''
as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(
    split_part(
      regexp_replace(
        regexp_replace(lower(coalesce(p_title, '')), '\(.*?\)|\[.*?\]', ' ', 'g'),
        '\s[-–—|/,:]\s|\s[-–—|]|,|\s@\s|\sat\s', chr(1), 'g'),
      chr(1), 1),
    '\y(senior|sr|junior|jr|staff|lead|principal|associate|entry[- ]level|internship|intern|iii|ii|i|iv|v|[0-9]+|part[- ]time|full[- ]time|ft|pt|prn|per diem|temporary|seasonal|remote|hybrid|onsite|on[- ]site|nights|night|days|weekends|weekend|shift|mid[- ]level|level)\y\.?', ' ', 'g'),
    '[^a-z&+# ]', ' ', 'g'),
    '\s+', ' ', 'g'))
$$;

alter table public.jobs add column if not exists role_slug text;
create index if not exists jobs_role_slug_idx on public.jobs (role_slug) where status = 'open' and role_slug is not null;

create or replace function private.set_job_role()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.role_slug := (select r.slug from public.role_titles as r where r.title = private.normal_title(new.title));
  return new;
end $$;

drop trigger if exists jobs_role_slug on public.jobs;
create trigger jobs_role_slug before insert or update of title on public.jobs
  for each row execute function private.set_job_role();

-- 3. Backfill -----------------------------------------------------------------------------------------------------
create table if not exists private.skill_backfill (
  id         int primary key default 1 check (id = 1),
  last_id    text not null default '',
  done       boolean not null default false,
  processed  bigint not null default 0,
  updated_at timestamptz not null default now()
);
insert into private.skill_backfill (id) values (1) on conflict (id) do nothing;

-- Works through open jobs in id order for at most p_seconds, then stops; the next call carries on.
create or replace function private.backfill_job_skills(p_seconds int default 25)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  cur text;
  stop_at timestamptz := clock_timestamp() + make_interval(secs => p_seconds);
  batch text[];
  n bigint := 0;
begin
  select last_id into cur from private.skill_backfill where id = 1 and not done;
  if not found then return; end if;
  loop
    select array_agg(id order by id) into batch
    from (select j.id from public.jobs as j where j.id > cur and j.status = 'open' order by j.id limit 200) as s;
    if batch is null then
      update private.skill_backfill set done = true, updated_at = now() where id = 1;
      exit;
    end if;
    update public.jobs as j
    set role_slug = (select r.slug from public.role_titles as r where r.title = private.normal_title(j.title)),
        skills = case when length(coalesce(j.description, '')) >= 200
                      then private.top_skills(j.title || chr(10) || j.description)
                      else j.skills end
    where j.id = any(batch);
    cur := batch[array_length(batch, 1)];
    n := n + array_length(batch, 1);
    update private.skill_backfill set last_id = cur, processed = processed + array_length(batch, 1), updated_at = now() where id = 1;
    exit when clock_timestamp() >= stop_at;
  end loop;
end $$;

-- 4. Role-skill graph ---------------------------------------------------------------------------------------------
create table if not exists public.role_skill_stats (
  slug   text not null,
  skill  text not null,
  jobs   int not null,   -- open jobs for this role that ask for the skill
  share  real not null,  -- of the role's tagged jobs
  lift   real not null,  -- share in this role / share across all roles (how distinctive)
  primary key (slug, skill)
);
create table if not exists public.role_totals (
  slug text primary key,
  jobs int not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.role_links (
  from_slug text not null,
  to_slug   text not null,
  score     real not null,     -- 0-1: how much of the two roles' distinctive skill demand overlaps
  shared    text[] not null,   -- the skills that carry over, strongest first
  primary key (from_slug, to_slug)
);
do $$
declare t text;
begin
  foreach t in array array['role_skill_stats', 'role_totals', 'role_links'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant all on table public.%I to service_role', t);
  end loop;
end $$;

create or replace function private.refresh_skill_graph()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  create temp table tagged on commit drop as
    select j.role_slug as slug, j.skills from public.jobs as j
    where j.status = 'open' and j.role_slug is not null and j.skills <> '{}';

  create temp table totals on commit drop as
    select slug, count(*)::int as jobs from tagged group by slug having count(*) >= 30;

  create temp table counts on commit drop as
    select t.slug, s.skill, count(*)::int as jobs
    from tagged as t cross join lateral unnest(t.skills) as s(skill)
    where t.slug in (select slug from totals)
    group by 1, 2;

  create temp table overall on commit drop as
    select c.skill, sum(c.jobs)::real / (select sum(jobs) from totals) as share from counts as c group by 1;

  delete from public.role_skill_stats;
  insert into public.role_skill_stats (slug, skill, jobs, share, lift)
    select c.slug, c.skill, c.jobs, c.jobs::real / t.jobs, (c.jobs::real / t.jobs) / nullif(o.share, 0)
    from counts as c join totals as t using (slug) join overall as o using (skill)
    where c.jobs >= 5 and c.jobs::real / t.jobs >= 0.05;

  delete from public.role_totals;
  insert into public.role_totals (slug, jobs) select slug, jobs from totals;

  -- Similarity: cosine over each role's skill weights (share x how distinctive), so generic skills like
  -- communication count for little and the skills that define a role count most.
  create temp table w on commit drop as
    select slug, skill, share * ln(1 + greatest(lift, 0)) as w from public.role_skill_stats;
  create temp table norms on commit drop as select slug, sqrt(sum(w * w)) as n from w group by slug;

  delete from public.role_links;
  insert into public.role_links (from_slug, to_slug, score, shared)
    select from_slug, to_slug, score, shared from (
      select a.slug as from_slug, b.slug as to_slug,
             (sum(a.w * b.w) / (na.n * nb.n))::real as score,
             (array_agg(a.skill order by least(a.w, b.w) desc))[1:8] as shared,
             row_number() over (partition by a.slug order by sum(a.w * b.w) / (na.n * nb.n) desc) as rk
      from w as a
      join w as b on b.skill = a.skill and b.slug <> a.slug
      join norms as na on na.slug = a.slug
      join norms as nb on nb.slug = b.slug
      group by a.slug, b.slug, na.n, nb.n
    ) as x
    where rk <= 40 and score >= 0.1;
end $$;

-- 5. Schedules (pg_cron, inside the database: no web request, no timeout) -----------------------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('skill-backfill', 'skill-graph');
select cron.schedule('skill-backfill', '*/2 * * * *', $$select private.backfill_job_skills(25)$$);
select cron.schedule('skill-graph', '30 3 * * *', $$select private.refresh_skill_graph()$$);

revoke all on all functions in schema private from public, anon, authenticated;

-- 6. Skill dictionary (generated by scripts/skills-sql.py from worker/rolearch_worker/data/skills.json) -----------
truncate private.skill_patterns;
insert into private.skill_patterns (name, cs, ci) values
  ('Python', null, '\ypython\y'),
  ('SQL', null, '\ysql\y'),
  ('Spark', null, '\y(?:apache )?spark\y|\ypyspark\y'),
  ('Kafka', null, '\ykafka\y'),
  ('Airflow', null, '\yairflow\y'),
  ('dbt', null, '\ydbt\y'),
  ('Snowflake', null, '\ysnowflake\y'),
  ('BigQuery', null, '\ybigquery\y'),
  ('Redshift', null, '\yredshift\y'),
  ('Databricks', null, '\ydatabricks\y'),
  ('AWS', null, '\yaws\y|amazon web services'),
  ('Google Cloud', null, '\ygoogle cloud\y|\ygcp\y(?! ?(?:guideline|training|compliance|inspection|regulation|requirement|standard)s?\y)'),
  ('Azure', null, '\yazure\y'),
  ('Kubernetes', null, '\ykubernetes\y|\yk8s\y'),
  ('Docker', null, '\ydocker\y'),
  ('Terraform', null, '\yterraform\y'),
  ('Go', null, '\ygolang\y'),
  ('Java', null, '\yjava\y(?!script)'),
  ('JavaScript', null, '\yjavascript\y'),
  ('TypeScript', null, '\ytypescript\y'),
  ('React', null, '\yreact(?:\.js|js| native)\y|\yreact,|, ?react\y|\yreact ?/|/ ?react\y'),
  ('Node.js', null, '\ynode\.?js\y'),
  ('C#', null, '\yc#|\.net\y'),
  ('C++', null, '\yc\+\+'),
  ('Scala', null, '\yscala\y'),
  ('Rust', null, '\yrust\y(?! ?(?:prevention|removal|proof))'),
  ('PyTorch', null, '\ypytorch\y'),
  ('TensorFlow', null, '\ytensorflow\y'),
  ('scikit-learn', null, 'scikit-learn|\ysklearn\y'),
  ('Pandas', null, '\ypandas\y'),
  ('Tableau', null, '\ytableau\y'),
  ('Looker', null, '\ylooker\y'),
  ('Power BI', null, '\ypower ?bi\y'),
  ('Statistics', null, '\ystatistic(?:s|al)\y'),
  ('Machine learning', null, '\ymachine learning\y'),
  ('Deep learning', null, '\ydeep learning\y'),
  ('LLMs', null, '\yllms?\y|large language models?|generative ai|\ygenai\y'),
  ('NLP', null, '\ynlp\y|natural language processing'),
  ('Computer vision', null, '\ycomputer vision\y'),
  ('MLOps', null, '\ymlops\y'),
  ('Postgres', null, '\ypostgres(?:ql)?\y'),
  ('MongoDB', null, '\ymongo(?:db)?\y'),
  ('A/B testing', null, '\ya/b test'),
  ('Excel', '\yExcel\y(?! (?:at|in)\y)', '\yms excel\y|\ymicrosoft excel\y'),
  ('Linux', null, '\ylinux\y'),
  ('Git', null, '\ygit\y(?!\w)|\ygithub\y|\ygitlab\y'),
  ('CI/CD', null, '\yci/cd\y|continuous integration'),
  ('REST APIs', null, '\yrest(?:ful)? apis?\y'),
  ('Cybersecurity', null, '\ycyber ?security\y|\yinformation security (?:analyst|engineer|controls|program|policies|frameworks?)\y|\yinfosec\y|\ysoc 2\y|\ysiem\y'),
  ('Network administration', null, '\ynetwork(?:ing)? (?:administration|engineering)\y|\ycisco\y|\yccna\y|tcp/ip'),
  ('IT support', null, '\yhelp ?desk\y|\yservice ?desk\y|technical support|desktop support'),
  ('Salesforce', null, '\ysalesforce\y'),
  ('SAP', null, '\ysap\y(?! ?(?:is|was))'),
  ('ERP systems', null, '\yerp\y|\yoracle (?:ebs|cloud|fusion|netsuite)\y|\ynetsuite\y|\yworkday\y|dynamics 365'),
  ('Data analysis', null, '\ydata analys[ie]s\y|analy[sz]e data|\ydata analytics\y'),
  ('Data visualization', null, '\ydata visuali[sz]ation\y|\ydashboards?\y'),
  ('Financial modeling', null, '\yfinancial model(?:l)?ing\y|\yfinancial models?\y'),
  ('Financial reporting', null, '\yfinancial (?:reporting|statements?)\y'),
  ('Accounting', null, '\yaccounting\y'),
  ('GAAP', '\yGAAP\y', null),
  ('CPA', '\yCPA\y', null),
  ('Accounts payable', null, '\yaccounts payable\y'),
  ('Accounts receivable', null, '\yaccounts receivable\y|\ycollections?\y(?= (?:process|calls|activity|activities))'),
  ('Bookkeeping', null, '\ybookkeeping\y'),
  ('Payroll', null, '\ypayroll\y'),
  ('Budgeting', null, '\ybudget(?:ing|s)?\y'),
  ('Forecasting', null, '\yforecast(?:ing|s)?\y'),
  ('Auditing', null, '\yaudit(?:ing|s)?\y'),
  ('Tax preparation', null, '\ytax (?:preparation|returns?|compliance)\y'),
  ('Risk management', null, '\yrisk management\y|\yrisk assessments?\y'),
  ('QuickBooks', null, '\yquickbooks\y'),
  ('Regulatory compliance', null, '\yregulatory compliance\y|\ycompliance (?:with|requirements|programs?)\y'),
  ('Project management', null, '\yproject management\y|\ymanage projects\y|\ypmp\y'),
  ('Agile', null, '\yagile\y|\yscrum\y|\ykanban\y'),
  ('Product management', null, '\yproduct management\y|\yproduct roadmaps?\y'),
  ('Process improvement', null, '\yprocess improvement\y|\ycontinuous improvement\y|\ykaizen\y'),
  ('Lean', null, '\ylean (?:manufacturing|principles|methodolog(?:y|ies)|six sigma)\y|\ylean\y(?= (?:tools|practices))'),
  ('Six Sigma', null, '\ysix sigma\y|\ydmaic\y'),
  ('Root cause analysis', null, '\yroot cause\y'),
  ('Quality control', null, '\yquality (?:control|assurance|inspections?)\y|\yqa/qc\y'),
  ('ISO standards', null, '\yiso ?(?:9001|13485|14001|27001|45001)\y'),
  ('Stakeholder management', null, '\ystakeholder(?:s| management)\y'),
  ('Vendor management', null, '\yvendor (?:management|relationships?)\y|\ysupplier (?:management|relationships?)\y'),
  ('Contract negotiation', null, '\ynegotiat(?:e|ion|ing)\y'),
  ('Procurement', null, '\yprocurement\y|\ypurchasing\y|\ysourcing\y'),
  ('Supply chain', null, '\ysupply chain\y'),
  ('Inventory management', null, '\yinventory\y'),
  ('Logistics', null, '\ylogistics\y|\yshipping and receiving\y'),
  ('Warehouse operations', null, '\ywarehouse\y|\ypick(?:ing)? and pack(?:ing)?\y|\yorder picking\y'),
  ('Forklift', null, '\yforklifts?\y|\ypallet jacks?\y|\yreach truck\y'),
  ('CDL', '\yCDL\y', 'commercial driver''?s licen[cs]e'),
  ('Route planning', null, '\yroute planning\y|\ydispatch(?:ing)?\y'),
  ('Demand planning', null, '\ydemand planning\y|\ys&op\y|\ymrp\y'),
  ('Production planning', null, '\yproduction (?:planning|scheduling)\y'),
  ('Manufacturing', null, '\ymanufacturing\y'),
  ('CAD', '\yCAD\y', '\yautocad\y|\ysolidworks\y|\ycatia\y|\yrevit\y'),
  ('GD&T', null, '\ygd&t\y'),
  ('PLC', '\yPLCs?\y', 'programmable logic controller'),
  ('Machining', null, '\ymachining\y|\ycnc\y'),
  ('Welding', null, '\yweld(?:ing|er)?\y'),
  ('Electrical systems', null, '\yelectrical (?:systems|wiring|troubleshooting|code)\y|\ynec\y(?= code)'),
  ('HVAC', '\yHVAC\y', null),
  ('Plumbing', null, '\yplumbing\y'),
  ('Carpentry', null, '\ycarpentry\y'),
  ('Blueprint reading', null, '\yblueprints?\y|\yschematics?\y|\ytechnical drawings?\y'),
  ('Equipment maintenance', null, '\ypreventive maintenance\y|\ypreventative maintenance\y|\yequipment maintenance\y'),
  ('Troubleshooting', null, '\ytroubleshoot(?:ing)?\y'),
  ('OSHA', '\yOSHA\y', null),
  ('Workplace safety', null, '\ysafety (?:procedures|protocols|standards|regulations|program)\y|\yehs\y'),
  ('Patient care', null, '\ypatient care\y|\ydirect care\y|\ybedside\y'),
  ('RN license', '\yRN\y', '\yregistered nurse\y'),
  ('LPN', '\yLPN\y|\yLVN\y', 'licensed practical nurse'),
  ('CNA', '\yCNA\y', 'certified nurs(?:ing|e) assistant'),
  ('EMT', '\yEMT\y', '\yparamedic\y'),
  ('BLS/CPR', null, '\ybls\y|\ycpr\y|basic life support'),
  ('ACLS', null, '\yacls\y|advanced cardiac life support'),
  ('Electronic health records', null, '\yehr\y|\yemr\y|electronic (?:health|medical) records?|\yepic\y(?= (?:systems?|ehr|emr))|\ycerner\y'),
  ('Medical terminology', null, '\ymedical terminology\y'),
  ('Medication administration', null, '\ymedication administration\y|\yadminister(?:ing)? medications?\y'),
  ('Vital signs', null, '\yvital signs\y'),
  ('Phlebotomy', null, '\yphlebotomy\y|\yvenipuncture\y'),
  ('Medical coding', null, '\ymedical coding\y|\yicd-?10\y|\ycpt cod'),
  ('Medical billing', null, '\ymedical billing\y|\yinsurance claims?\y'),
  ('HIPAA', null, '\yhipaa\y'),
  ('Infection control', null, '\yinfection (?:control|prevention)\y'),
  ('Case management', null, '\ycase management\y'),
  ('Clinical research', null, '\yclinical (?:research|trials?)\y|good clinical practice'),
  ('Pharmacy', null, '\ypharmacy\y|\ypharmacist\y'),
  ('Laboratory techniques', null, '\ylaboratory (?:techniques|procedures|testing)\y|\ylab techniques\y|\ypcr\y'),
  ('Mental health', null, '\ymental health\y(?! (?:benefits|support|resources|days?|program|coverage))|\ybehavioral health\y'),
  ('Counseling', null, '\ycounsel(?:l)?ing\y'),
  ('Social work', null, '\ysocial work\y|\ylcsw\y|\ymsw\y'),
  ('Teaching', null, '\yteach(?:ing|er)?\y'),
  ('Curriculum development', null, '\ycurriculum\y|\ylesson plans?\y'),
  ('Classroom management', null, '\yclassroom management\y'),
  ('Special education', null, '\yspecial education\y|\yiep\y'),
  ('Teaching license', null, '\yteaching (?:license|certificat(?:e|ion))\y|\ystate certification\y(?= in)'),
  ('Instructional design', null, '\yinstructional design\y|\ye-?learning\y'),
  ('Training and coaching', null, '\ytrain(?:ing)? (?:new )?(?:staff|employees|team members)\y|\ycoach(?:ing)?\y|\ymentor(?:ing)?\y'),
  ('Customer service', null, '\ycustomer service\y|\yguest service\y'),
  ('Customer success', null, '\ycustomer success\y|\yaccount management\y'),
  ('Sales', null, '\ysales\y'),
  ('B2B sales', null, '\yb2b\y|\yenterprise sales\y'),
  ('Lead generation', null, '\ylead generation\y|\yprospecting\y|\ycold call'),
  ('CRM', null, '\ycrm\y|\yhubspot\y'),
  ('Point of sale', null, '\ypoint of sale\y|\ypos\y(?= system)|\ycash handling\y|\ycash register\y'),
  ('Merchandising', null, '\ymerchandising\y|\yvisual merchandising\y'),
  ('Retail operations', null, '\yretail (?:operations|store)\y|\ystore operations\y'),
  ('Food safety', null, '\yfood safety\y|\yservsafe\y|\yfood handler'),
  ('Food preparation', null, '\yfood prep(?:aration)?\y|\yline cook\y|\yculinary\y'),
  ('Hospitality', null, '\yhospitality\y|\yfront desk\y'),
  ('Marketing', null, '\ymarketing\y'),
  ('Digital marketing', null, '\ydigital marketing\y|\ypaid (?:social|search|media)\y|\yppc\y|\ygoogle ads\y'),
  ('SEO', null, '\yseo\y|search engine optimi[sz]ation'),
  ('Content writing', null, '\ycontent (?:writing|creation|strategy)\y|\ycopywriting\y'),
  ('Social media', null, '\ysocial media (?:marketing|management|strategy|content|campaigns|platforms|accounts|channels)\y'),
  ('Email marketing', null, '\yemail marketing\y|\ymarketing automation\y|\ymarketo\y'),
  ('Market research', null, '\ymarket research\y|\ycompetitive analysis\y'),
  ('Brand management', null, '\ybrand (?:management|strategy)\y'),
  ('Public relations', null, '\ypublic relations\y|\ymedia relations\y'),
  ('Graphic design', null, '\ygraphic design\y|\yadobe (?:creative suite|illustrator|photoshop|indesign)\y|\yphotoshop\y|\yillustrator\y(?! of)'),
  ('UX design', null, '\yux\y|\yuser experience\y|\yuser research\y|\ywireframes?\y|\yusability\y'),
  ('Figma', null, '\yfigma\y'),
  ('Video editing', null, '\yvideo editing\y|\ypremiere pro\y|\yfinal cut\y|\yafter effects\y'),
  ('Technical writing', null, '\ytechnical writ(?:ing|er)\y|\ytechnical documentation\y|\ywrit(?:e|ing) (?:technical )?(?:specifications|user guides|manuals)\y'),
  ('Recruiting', null, '\yfull[- ]cycle recruit|\ytalent acquisition\y(?! team)|\ysourc(?:e|ing) (?:and screen(?:ing)? )?candidates\y|\yapplicant tracking system|\yrecruiting (?:strategy|strategies|pipeline|metrics)\y|\ycandidate pipelines?\y'),
  ('HR administration', null, '\yhris\y|\ybenefits administration\y|\yhr (?:administration|generalist|operations)\y|\yhuman resources (?:generalist|administration|policies|operations)\y|\yemployee onboarding\y'),
  ('Employee relations', null, '\yemployee relations\y|\ylabor relations\y'),
  ('Compensation', null, '\ycompensation (?:analysis|planning|programs|strategy|structures?|benchmarking)\y'),
  ('Legal research', null, '\ylegal research\y|\ywestlaw\y|\ylexis(?:nexis)?\y'),
  ('Contract management', null, '\ycontract (?:management|drafting|review|administration)\y'),
  ('Litigation', null, '\ylitigation\y'),
  ('Paralegal', null, '\yparalegal\y'),
  ('Scheduling', null, '\yscheduling\y|\ycalendar management\y'),
  ('Data entry', null, '\ydata entry\y'),
  ('Microsoft Office', null, '\ymicrosoft office\y|\yms office\y|\ymicrosoft 365\y|\yoffice 365\y|\yword, excel\y'),
  ('Office administration', null, '\yoffice (?:administration|management)\y|\yadministrative support\y|\yreception(?:ist)?\y'),
  ('Bilingual Spanish', null, '\ybilingual\y|\yspanish\y'),
  ('Communication', null, '\y(?:written and verbal|verbal and written|excellent|strong) communication\y'),
  ('Leadership', null, '\yleadership\y|\ypeople management\y|\ymanage a team\y|\ysupervis(?:e|ing|ory)\y'),
  ('Team management', null, '\yteam (?:management|leadership)\y|\ydirect reports\y'),
  ('Problem solving', null, '\yproblem[- ]solving\y'),
  ('Research', null, '\yresearch\y'),
  ('Biology', null, '\ybiology\y|\ymolecular biology\y|\ycell culture\y'),
  ('Chemistry', null, '\ychemistry\y|\yhplc\y|\yanalytical chemistry\y'),
  ('GIS', null, '\ygis\y|\yarcgis\y'),
  ('Civil engineering', null, '\ycivil engineering\y|\ystructural (?:engineering|analysis|design)\y'),
  ('Mechanical engineering', null, '\ymechanical engineering\y|\ymechanical design\y|\yfea\y'),
  ('Electrical engineering', null, '\yelectrical engineering\y|\ycircuit design\y|\ypcb\y'),
  ('MATLAB', null, '\ymatlab\y'),
  ('Construction management', null, '\yconstruction management\y|\ysite supervision\y|\yconstruction (?:projects|sites?)\y'),
  ('Security operations', null, '\ysecurity (?:guard|officer|patrol)s?\y|\yaccess control\y|\yloss prevention\y'),
  ('Driving', null, '\ydriver''?s licen[cs]e\y|\yclean driving record\y|\ydelivery driver\y'),
  ('Cleaning', null, '\yjanitorial\y|\ycustodial\y|\yhousekeeping\y|\ysanitation\y');
