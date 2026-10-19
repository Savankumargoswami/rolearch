import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/jobs", "/account", "/u/", "/feed", "/search"] }, sitemap: "https://rolearch.com/sitemap.xml" };
}
