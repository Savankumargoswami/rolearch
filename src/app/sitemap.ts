import type { MetadataRoute } from "next";
import { jobs } from "@/data/jobs";

const base = "https://rolearch.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/jobs`, changeFrequency: "hourly", priority: 0.9 },
    ...jobs.map((j) => ({ url: `${base}/jobs/${j.id}`, changeFrequency: "daily" as const, priority: 0.7 })),
  ];
}
