// Full job records for server-rendered pages. Written by the job-feed worker
// (worker/: `python -m rolearch_worker run`); falls back to sample jobs if empty.
import "server-only";
import feed from "./feed.json";
import { sampleJobs } from "./sample-jobs";
import type { Job } from "./types";

export type { Job, JobLite, Level, Region, Workplace } from "./types";

const live = feed.jobs as unknown as Job[];

export const isLive = live.length > 0;
export const jobs: Job[] = isLive ? live : sampleJobs;
export const feedMeta = {
  generatedAt: isLive ? feed.generatedAt : null,
  companies: isLive ? feed.companies : new Set(sampleJobs.map((j) => j.company)).size,
  countries: isLive ? feed.countries : new Set(sampleJobs.map((j) => j.country)).size,
};

const byId = new Map(jobs.map((j) => [j.id, j]));

export function getJob(id: string): Job | undefined {
  return byId.get(id);
}
