import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/jobs", "/account", "/u/", "/feed", "/search", "/hire", "/tracker", "/feedback", "/api/"] }, sitemap: "https://rolearch.com/sitemap.xml" };
}
