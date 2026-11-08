import { jobSitemapPages } from "@/data/db";

// One sitemap index for Search Console: the main sitemap (pages, roles, guides, blog) plus every job sitemap file,
// so a single submission covers the whole site.
const base = "https://www.rolearch.com";

export async function GET() {
  const pages = await jobSitemapPages();
  const urls = [`${base}/sitemap.xml`, ...Array.from({ length: pages }, (_, i) => `${base}/sitemaps/jobs/sitemap/${i}.xml`)];
  const xml = `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((u) => `<sitemap><loc>${u}</loc></sitemap>`).join("")}</sitemapindex>`;
  return new Response(xml, { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
