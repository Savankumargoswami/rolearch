import type { MetadataRoute } from "next";
import { jobSitemap, jobSitemapPages } from "@/data/db";

const base = "https://www.rolearch.com";

/** Every open job's public page, split into files of SITEMAP_PAGE: /sitemaps/jobs/sitemap/{n}.xml. */
export async function generateSitemaps() {
  return Array.from({ length: await jobSitemapPages() }, (_, id) => ({ id }));
}

export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const page = Number(await props.id) || 0;
  return (await jobSitemap(page)).map(([id, posted]) => ({
    url: `${base}/jobs/${id}`,
    ...(posted && { lastModified: posted }),
  }));
}
