# Rolearch job-feed worker

Pulls open jobs from each listed company's own careers board into Rolearch. Apply on Rolearch sends people straight to that job on the company's site.

## How it gets jobs

Most companies run their careers page on an applicant tracking system (ATS). Each of these publishes a free, public job feed meant for careers sites and job boards, so the worker reads those feeds instead of scraping HTML:

| ATS | Feed |
| --- | --- |
| Greenhouse | `boards-api.greenhouse.io/v1/boards/{token}/jobs` |
| Lever | `api.lever.co/v0/postings/{site}` (EU: `api.eu.lever.co`) |
| Ashby | `api.ashbyhq.com/posting-api/job-board/{name}` |
| Workable | `apply.workable.com/api/v1/widget/accounts/{subdomain}` |
| SmartRecruiters | `api.smartrecruiters.com/v1/companies/{id}/postings` |
| Recruitee | `{company}.recruitee.com/api/offers/` |
| Personio | `{company}.jobs.personio.de/xml` |
| Anything else | `jsonld`: reads the schema.org JobPosting data careers pages publish for Google, only from the `careers_url` you list, only where robots.txt allows |

It never logs in, never submits applications, and never touches LinkedIn, Indeed or Glassdoor. Requests identify themselves (`RolearchBot/0.1 (+https://rolearch.com/bot; admin@rolearch.com)`), are limited to 2 at a time per host, and back off on rate limits.

## What it stores per job

Title, company, city/country/region, remote/hybrid/on-site, salary (when published), level, years required, top skills, visa sponsorship, a one-sentence summary, the job page URL and the apply URL. Not the full description: the job page links to the company's own page for that.

Every run also:

- **closes jobs that left the company's board** (the "no stale jobs" promise);
- **won't close anything if a board that had 20+ jobs suddenly returns 0** (treated as a feed problem);
- **spot-checks 3 new apply links per board** and skips a board whose links are all dead (an abandoned ATS account);
- **closes the jobs of companies you remove** from `companies.csv`.

## Run it

```bash
cd worker
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt      # Windows; on Mac/Linux: .venv/bin/pip
.venv\Scripts\python -m rolearch_worker run        # all companies, about 75 seconds
.venv\Scripts\python -m rolearch_worker run --only stripe
.venv\Scripts\python -m unittest discover -s tests # tests, no network
```

With `DATABASE_URL` set (the normal setup), jobs go straight into Supabase and the site picks them up within an hour; no rebuild needed.

Without it, jobs go to `state/jobs.json` and the site's fallback files in `src/data/` (`feed.json`, used when Supabase isn't configured, and `feed-suggest.json`, the search suggestions). Refresh those occasionally with a run that has no `DATABASE_URL`.

`DATABASE_URL` is the Supabase Postgres connection string (Connect → Session pooler); the tables come from `db/schema.sql`.

## Adding companies

1. Add a row to `companies/candidates.csv`: `name,country,slugs,careers_url`. `slugs` are guesses for the board name, separated by `|` (usually the company name in lowercase). `country` is the HQ's two-letter code, used only when a job's location has no country.
2. Run `python -m rolearch_worker discover`. It tries each slug on each ATS and appends the boards it finds to `companies/companies.csv`.
3. **Check new rows before trusting them.** A board called `wise` or `monday` can belong to a different company with the same name. Open one job URL from each new board.
4. Companies it can't find use an ATS that has no public feed (Workday, iCIMS, SuccessFactors, in-house sites). Give them a `careers_url` to try the `jsonld` reader, or leave them for a licensed feed later.

`companies.csv` today: 104 verified companies in 27 countries. The 45 candidates not found yet are listed by `discover`.

## Schedule

`railway.json` runs it every 6 hours on Railway (`0 */6 * * *`). Railway's disk resets between runs, so set `DATABASE_URL` there; the JSON state file is for local use.
