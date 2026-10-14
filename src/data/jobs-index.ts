// Compact job list for the search page, safe to ship to the browser.
import index from "./feed-index.json";
import { sampleJobs } from "./sample-jobs";
import type { JobLite } from "./types";

const live = index.jobs as unknown as JobLite[];

export const jobIndex: JobLite[] = live.length > 0 ? live : sampleJobs;
export const indexMeta = { generatedAt: live.length > 0 ? index.generatedAt : null, companies: index.companies };
