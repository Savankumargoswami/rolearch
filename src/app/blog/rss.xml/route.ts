import { SITE, listPosts, postUrl } from "@/lib/blog";

// RSS for the blog, so feed readers, newsletters and search tools pick up new articles.
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

export async function GET() {
  const posts = await listPosts(undefined, 50);
  const items = posts
    .map(
      (p) =>
        `<item><title>${esc(p.title)}</title><link>${postUrl(p.slug)}</link><guid>${postUrl(p.slug)}</guid><pubDate>${new Date(p.published_at).toUTCString()}</pubDate><description>${esc(p.description)}</description></item>`,
    )
    .join("");
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Rolearch blog</title><link>${SITE}/blog</link><description>Researched articles on the skills each industry is hiring for and how to learn them.</description><language>en-us</language>${items}</channel></rss>`;
  return new Response(xml, { headers: { "Content-Type": "application/rss+xml; charset=utf-8", "Cache-Control": "public, max-age=3600" } });
}
