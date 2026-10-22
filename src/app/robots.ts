import type { MetadataRoute } from "next";
import { jobSitemapPages } from "@/data/db";

const base = "https://www.rolearch.com";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const pages = await jobSitemapPages();
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Job pages (/jobs/{id}) are public for search engines; the search list and member areas aren't.
      disallow: ["/jobs$", "/jobs?", "/jobs/*/apply", "/account", "/u/", "/feed", "/search", "/hire", "/tracker", "/feedback", "/api/"],
    },
    sitemap: [`${base}/sitemap.xml`, ...Array.from({ length: pages }, (_, i) => `${base}/sitemaps/jobs/sitemap/${i}.xml`)],
  };
}
