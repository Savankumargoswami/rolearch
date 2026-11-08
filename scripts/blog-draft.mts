// Writes blog post number N (default 0) to a JSON file without publishing, for review:
//   npx tsx --env-file=.env.local --conditions=react-server scripts/blog-draft.mts 0 out.json
import { writeFileSync } from "node:fs";
import type { Hiring } from "../src/lib/blog-writer.ts";

// The app's modules are CommonJS to tsx; take their exports from the namespace.
const load = async (p: string) => {
  const m = await import(p);
  return m.default ?? m;
};
const { planFor } = await load("../src/lib/blog.ts");
const { writePost } = await load("../src/lib/blog-writer.ts");

const n = Number(process.argv[2] ?? 0);
const out = process.argv[3] ?? `blog-draft-${n}.json`;
const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const { industry, question } = planFor(n) as { industry: { name: string; cat: string }; question: string };
console.log(`Post ${n}: ${industry.name} — ${question}`);
const t0 = Date.now();
const hiring: Hiring | null = await fetch(`${base}/rest/v1/rpc/jobs_digest`, {
  method: "POST",
  headers: { apikey: process.env.SUPABASE_SERVICE_ROLE_KEY!, "Content-Type": "application/json" },
  body: JSON.stringify({ p_secret: process.env.POST_REVIEW_SECRET, p_topic: industry.cat, p_since: new Date(Date.now() - 14 * 86_400_000).toISOString() }),
})
  .then((r) => (r.ok ? r.json() : null))
  .catch(() => null);
console.log("hiring:", hiring ? `${hiring.total} jobs, skills: ${hiring.skills.slice(0, 8).join(", ")}` : "none");
const post = await writePost(n, hiring);
writeFileSync(out, JSON.stringify({ ...post, published_at: new Date().toISOString() }, null, 2));
console.log(`done in ${Math.round((Date.now() - t0) / 1000)}s: ${post.title} (${post.body.split(/\s+/).length} words, ${post.sources.length} sources) -> ${out}`);
