# Rolearch

Verified jobs from company career pages worldwide, with your match shown before you apply.

Jobs are real: the Python worker in [`worker/`](worker/README.md) pulls them from 104 companies' own careers boards (Greenhouse, Lever, Ashby, Workable, SmartRecruiters, Recruitee) into `src/data/feed*.json`, and Apply goes straight to the job on the company's site. Run the worker, then rebuild. Accounts and Supabase plug in next; `db/schema.sql` has the tables. Without a feed file the site falls back to sample jobs (`src/data/sample-jobs.ts`).

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
npm run build && npm start   # production build
```

Requires Node 20+. Next.js 16.4 with Cache Components; read `node_modules/next/dist/docs/` before changing framework-level code (see `AGENTS.md`).

## What's where

| Path | What it is |
| --- | --- |
| `src/app/page.tsx` | Landing page: hero search, map, fresh jobs, how it works, companies |
| `src/app/jobs/page.tsx` + `components/jobs-explorer.tsx` | Search with filters; state lives in the URL so searches can be shared |
| `src/app/jobs/[id]/page.tsx` | Job detail: match check, free learning links, JobPosting structured data |
| `src/app/signup`, `src/app/signin` | Account screens (validation only; nothing is sent) |
| `src/data/` | Sample jobs, sample profile, free learning resources |
| `src/lib/match.ts` | Match %: verified skill = 1, listed = ½, missing = 0, experience counts as one |
| `src/i18n/` | All copy and locale settings |

## Design

Direction **Atlas**: calm, global, restrained. Tagline: **One network, endless opportunity.** Bricolage Grotesque for display, Geist for body. Colors are defined once in `src/app/globals.css` and match the logo kit: `ink` #0E1F2F and the amber `signal` #E0A35B (graphics only, 2.0:1 on paper; `signal-ink` #8F5B12 is the text-safe amber), plus `paper`, `surface`, `muted` and `line`.

Logo files live in `public/brand/` (from the Rolearch logo kit; `logo.svg` and `logo-reversed.svg` are cropped to the artwork). Favicon, SVG icon and Apple touch icon are in `src/app/`; PWA icons in `public/`.

Motion uses React's built-in `<ViewTransition>`, so there is no animation library:

- the hero rises in once and the map's pins land west to east (the page's one orchestrated moment)
- result rows glide to their new order as you type or filter
- a job's title morphs from its row into the detail page; forward and back links slide in their direction
- `prefers-reduced-motion` removes movement everywhere and the typed search hints never start

## Adding a language

1. Copy `src/i18n/messages/en.ts` to e.g. `de.ts` and translate the values.
2. Add it to `messages` in `src/i18n/index.ts` and to `locales` in `src/i18n/config.ts`.

Dates, salaries and currencies format through `Intl` for the active locale. The layout uses logical properties (`ps-`, `me-`, `start-`), so right-to-left languages (`ar`, `he`, `fa`, `ur`) get `dir="rtl"` automatically.

## Quality bar

Checked against *The $10K Checklist*: committed point of view, chosen type pairing (no Inter/Roboto), a 5-color system, clear hierarchy, purposeful imagery (the meridian map, drawn in code), restrained motion, a phone layout designed separately (stacked rows, swipeable filter chips, no horizontal scroll at 375px), and the invisible work: all pages prerendered, WCAG AA contrast, skip link and visible focus, semantic HTML, real metadata, Open Graph image, sitemap, robots and manifest.
