import type { MetadataRoute } from "next";
import { TOPICS } from "@/lib/daily-post";
import { METROS, ROLES, SPECIAL } from "@/lib/seo-pages";

const base = "https://www.rolearch.com";

export default function sitemap(): MetadataRoute.Sitemap {
  // Role pages: nationwide, remote, visa sponsorship and each metro (pages with too few jobs mark themselves noindex).
  const roles: MetadataRoute.Sitemap = ROLES.flatMap((r) => [
    { url: `${base}/roles/${r.slug}`, changeFrequency: "daily" as const, priority: 0.7 },
    ...[...SPECIAL, ...METROS].map((p) => ({ url: `${base}/roles/${r.slug}/${p.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
  ]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ats`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/roles`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...TOPICS.map((t) => ({ url: `${base}/today/${t.key}`, changeFrequency: "hourly" as const, priority: 0.7 })),
    ...roles,
  ];
}
