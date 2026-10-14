import type { Metadata } from "next";
import { Suspense, ViewTransition } from "react";
import { JobRow } from "@/components/job-row";
import { JobsExplorer } from "@/components/jobs-explorer";
import { getJobFeed } from "@/data/db";
import type { Job, JobLite } from "@/data/types";
import { t } from "@/i18n";
import { emptyFilters, filterJobs } from "@/lib/search";

export const metadata: Metadata = {
  title: t("jobs.title"),
  alternates: { canonical: "/jobs" },
};

/** Only the fields the search page needs in the browser. */
const lite = ({ id, title, company, city, country, region, workplace, visa, salary, level, years, skills, postedDaysAgo }: Job): JobLite => ({
  id, title, company, city, country, region, workplace, visa, salary, level, years, skills, postedDaysAgo,
});

/** Server-rendered first page: what crawlers and no-JS visitors see, and the first paint for everyone. */
function StaticList({ jobs }: { jobs: JobLite[] }) {
  const all = filterJobs(jobs, emptyFilters);
  const first = all.slice(0, 40);
  return (
    <div>
      <div className="h-[7.5rem] border-b border-line sm:h-[6.75rem]" aria-hidden="true" />
      <p className="mt-5 font-display text-xl font-semibold">{t("jobs.count", { n: all.length })}</p>
      <ul className="-mx-3 mt-2 divide-y divide-line sm:-mx-4">
        {first.map((job) => (
          <li key={job.id}>
            <JobRow job={job} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function JobsPage() {
  const feed = await getJobFeed();
  const jobs = feed.jobs.map(lite);
  return (
    <ViewTransition
      enter={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      exit={{ "nav-forward": "nav-forward", "nav-back": "nav-back", default: "none" }}
      default="none"
    >
      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <h1 className="sr-only">{t("jobs.title")}</h1>
        <Suspense fallback={<StaticList jobs={jobs} />}>
          <JobsExplorer jobs={jobs} updatedAt={feed.updatedAt} companies={feed.companies} />
        </Suspense>
      </div>
    </ViewTransition>
  );
}
