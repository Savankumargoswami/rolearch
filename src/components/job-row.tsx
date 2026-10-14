import Link from "next/link";
import { ViewTransition } from "react";
import type { JobLite } from "@/data/types";
import { t } from "@/i18n";
import { place, postedAgo, salaryRange } from "@/lib/format";
import { matchJob } from "@/lib/match";
import { MatchRing } from "./match-ring";

/** One job in a list. Plain component (no hooks) so server and client lists share it. */
export function JobRow({ job }: { job: JobLite }) {
  const match = matchJob(job);
  return (
    <Link
      href={`/jobs/${job.id}`}
      transitionTypes={["nav-forward"]}
      className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1 rounded-xl px-3 py-4 transition-colors duration-200 hover:bg-surface sm:px-4 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto]"
    >
      <span className="min-w-0 md:[grid-area:1/1]">
        <ViewTransition name={`job-title-${job.id}`} share="morph" default="none">
          <span className="block truncate font-display text-[1.08rem] font-semibold tracking-[-0.01em] group-hover:underline group-hover:decoration-line group-hover:underline-offset-4">
            {job.title}
          </span>
        </ViewTransition>
        <span className="block truncate text-[0.95rem] text-muted">{job.company}</span>
      </span>

      <span className="col-start-2 row-span-2 row-start-1 md:[grid-area:1/4]">
        <MatchRing score={match.score} verdict={match.verdict} size={48} />
      </span>

      <span className="min-w-0 truncate text-[0.95rem] text-muted md:text-ink md:[grid-area:1/2]">
        {place(job)}
        <span className="text-muted"> · {t(`workplace.${job.workplace}` as const)}</span>
      </span>

      <span className="col-span-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.9rem] text-muted md:block md:[grid-area:1/3]">
        <span className="tabular-nums md:block md:text-ink">{job.salary ? salaryRange(job.salary) : t("job.salaryHidden")}</span>
        <span className="md:block">{postedAgo(job.postedDaysAgo)}</span>
      </span>
    </Link>
  );
}
