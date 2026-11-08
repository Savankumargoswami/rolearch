import type { MetadataRoute } from "next";
import { listPosts } from "@/lib/blog";
import { TOPICS } from "@/lib/daily-post";
import { GUIDES } from "@/lib/transition-guides";
import { METROS, ROLES, SPECIAL } from "@/lib/seo-pages";

const base = "https://www.rolearch.com";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const posts = await listPosts(undefined, 1000);
  // Role pages: nationwide, remote, visa sponsorship and each metro (pages with too few jobs mark themselves noindex).
  const roles: MetadataRoute.Sitemap = ROLES.flatMap((r) => [
    { url: `${base}/roles/${r.slug}`, changeFrequency: "daily" as const, priority: 0.7 },
    ...[...SPECIAL, ...METROS].map((p) => ({ url: `${base}/roles/${r.slug}/${p.slug}`, changeFrequency: "daily" as const, priority: 0.6 })),
  ]);
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/ats`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/roles`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/roadmaps`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/features`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/skills`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/guides`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/blog`, changeFrequency: "daily", priority: 0.8 },
    ...posts.map((p) => ({ url: `${base}/blog/${p.slug}`, lastModified: p.published_at, changeFrequency: "monthly" as const, priority: 0.7 })),
    ...GUIDES.map((g) => ({ url: `${base}/guides/${g.slug}`, changeFrequency: "monthly" as const, priority: 0.7 })),
    { url: `${base}/employers`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/signup`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/privacy`, changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, changeFrequency: "yearly", priority: 0.2 },
    ...TOPICS.map((t) => ({ url: `${base}/today/${t.key}`, changeFrequency: "hourly" as const, priority: 0.7 })),
    ...roles,
  ];
}
