import type { MetadataRoute } from "next";
import { getJobFeed } from "@/data/db";

const base = "https://rolearch.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { jobs } = await getJobFeed();
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    ...jobs.slice(0, 2000).map((j) => ({ url: `${base}/jobs/${j.id}`, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
