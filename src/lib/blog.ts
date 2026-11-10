// The Rolearch blog: researched articles on the skills each industry is hiring for and how learning new ones helps
// people get hired in an AI-driven job market. The blog cron writes one every other day, rotating through industries
// and questions (blog-writer.ts); readers can opt in to email updates (double opt-in). Tables: db/038_blog.sql.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { dataKey } from "@/lib/supabase/data-key";
import { utm } from "@/lib/utm";

export const SITE = "https://www.rolearch.com";
const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

/** Industries the blog covers, in rotation. `cat` is the job category used for live hiring data (jobs_digest). */
export const INDUSTRIES = [
  { key: "software", name: "Software engineering", cat: "software" },
  { key: "healthcare", name: "Healthcare", cat: "healthcare" },
  { key: "data", name: "Data and AI", cat: "data" },
  { key: "finance", name: "Finance and accounting", cat: "finance" },
  { key: "manufacturing", name: "Manufacturing", cat: "manufacturing" },
  { key: "marketing", name: "Marketing", cat: "marketing" },
  { key: "logistics", name: "Supply chain and logistics", cat: "logistics" },
  { key: "education", name: "Education", cat: "education" },
  { key: "engineering", name: "Engineering", cat: "engineering" },
  { key: "sales", name: "Sales", cat: "sales" },
  { key: "trades", name: "Skilled trades", cat: "trades" },
  { key: "hr", name: "HR and recruiting", cat: "hr" },
  { key: "customer", name: "Customer support", cat: "customer" },
  { key: "design", name: "Design", cat: "design" },
  { key: "legal", name: "Legal", cat: "legal" },
  { key: "science", name: "Science and research", cat: "science" },
  { key: "hospitality", name: "Hospitality", cat: "hospitality" },
  { key: "retail", name: "Retail", cat: "retail" },
  { key: "admin", name: "Administration and operations", cat: "admin" },
  { key: "driving", name: "Transportation and driving", cat: "driving" },
] as const;
export type IndustryKey = (typeof INDUSTRIES)[number]["key"];
export const industry = (key: string) => INDUSTRIES.find((i) => i.key === key);

/** The questions the blog answers for each industry, in rotation. */
export const ANGLES = [
  "Which skills are {industry} employers hiring for right now, and which ones are fading?",
  "How is AI changing {industry} jobs, and which skills keep people employable?",
  "Does learning a new skill actually help you get a {industry} job? What the evidence says",
  "The fastest proven ways to upskill for {industry} roles this year",
  "Moving into {industry} from another career: which skills transfer and what to learn first",
] as const;

/** Post number n (0-based) covers this industry and question; every industry is covered before a question repeats. */
export function planFor(n: number) {
  const ind = INDUSTRIES[n % INDUSTRIES.length];
  const angle = ANGLES[Math.floor(n / INDUSTRIES.length) % ANGLES.length];
  return { industry: ind, question: angle.replaceAll("{industry}", ind.name.toLowerCase()) };
}

export type Faq = { q: string; a: string };
export type Source = { title: string; url: string };
export type Post = {
  slug: string;
  title: string;
  description: string;
  industry: string;
  body: string;
  key_points: string[];
  faq: Faq[];
  sources: Source[];
  skills: string[];
  reading_minutes: number;
  published_at: string;
};
export type PostCard = Pick<Post, "slug" | "title" | "description" | "industry" | "reading_minutes" | "published_at">;

/** PostgREST with the server key. Throws on errors so callers can decide. */
export async function rest<T>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
  if (!BASE || !dataKey) throw new Error("Supabase not configured");
  const res = await fetch(`${BASE}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: dataKey, "Content-Type": "application/json", ...(init.prefer ? { Prefer: init.prefer } : {}), ...init.headers },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path.split("?")[0]} ${res.status} ${await res.text()}`);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

const CARD = "slug,title,description,industry,reading_minutes,published_at";

/** Newest posts, optionally for one industry. Empty when the blog table isn't there yet. */
export async function listPosts(ind?: string, limit = 60): Promise<PostCard[]> {
  "use cache: remote";
  cacheLife("hours");
  cacheTag("blog");
  const filter = ind && industry(ind) ? `&industry=eq.${ind}` : "";
  try {
    return await rest<PostCard[]>(`blog_posts?select=${CARD}${filter}&order=published_at.desc&limit=${limit}`);
  } catch {
    return [];
  }
}

export async function getPost(slug: string): Promise<Post | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("blog");
  if (!/^[a-z0-9-]{1,90}$/.test(slug)) return null;
  try {
    const rows = await rest<Post[]>(`blog_posts?select=*&slug=eq.${slug}&limit=1`);
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

export const postUrl = (slug: string) => `${SITE}/blog/${slug}`;

export const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

// ---------- Email ----------

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

const shell = (inner: string, footer: string) => `<!doctype html><html><body style="margin:0;background:#f4f5f1">
<div style="max-width:600px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#0e1f2f;background:#fff">
<p style="margin:0;font-size:20px;font-weight:700">Rolearch blog</p>
${inner}
<p style="margin:28px 0 0;color:#777;font-size:12px">${footer}</p>
</div></body></html>`;

export function confirmEmail(token: string) {
  const link = `${SITE}/blog/confirm?t=${token}`;
  return {
    subject: "Confirm your Rolearch blog updates",
    html: shell(
      `<p style="margin:16px 0 0;line-height:1.55">Confirm your email and we'll send you each new Rolearch article: researched answers on which skills employers are hiring for, and how to learn them, industry by industry.</p>
<p style="margin:22px 0 0"><a href="${link}" style="display:inline-block;background:#0e1f2f;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:600">Confirm my email</a></p>`,
      "You get this because someone entered this address on rolearch.com/blog. If that wasn't you, ignore this email and nothing more will be sent.",
    ),
  };
}

export function postEmail(p: Pick<Post, "slug" | "title" | "description" | "key_points">, token: string) {
  const link = utm(postUrl(p.slug), "blog-email", "email", p.slug.slice(0, 60)).replaceAll("&", "&amp;");
  const points = p.key_points.map((k) => `<li style="margin:0 0 6px">${esc(k)}</li>`).join("");
  return {
    subject: p.title,
    html: shell(
      `<h1 style="font-size:22px;line-height:1.25;margin:16px 0 0"><a href="${link}" style="color:#0e1f2f;text-decoration:none">${esc(p.title)}</a></h1>
<p style="margin:10px 0 0;color:#444;line-height:1.55">${esc(p.description)}</p>
${points ? `<p style="margin:18px 0 6px;font-weight:600">Key points</p><ul style="margin:0;padding-left:20px;line-height:1.5">${points}</ul>` : ""}
<p style="margin:22px 0 0"><a href="${link}" style="display:inline-block;background:#0e1f2f;color:#fff;padding:11px 18px;border-radius:999px;text-decoration:none;font-weight:600">Read the article</a></p>`,
      `You get this because you subscribed to Rolearch blog updates. <a href="${SITE}/blog/unsubscribe?t=${token}" style="color:#777">Unsubscribe</a>`,
    ),
  };
}

export type Mail = { to: string; subject: string; html: string; token?: string };

/** Sends through Resend, 100 per request. Returns how many were accepted. */
export async function sendMail(mails: Mail[]): Promise<{ sent: number; errors: string[] }> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: 0, errors: ["RESEND_API_KEY not set"] };
  let sent = 0;
  const errors: string[] = [];
  for (let i = 0; i < mails.length; i += 100) {
    const batch = mails.slice(i, i + 100).map((m) => ({
      from: "Rolearch <noreply@rolearch.com>",
      to: [m.to],
      subject: m.subject,
      html: m.html,
      ...(m.token
        ? { headers: { "List-Unsubscribe": `<${SITE}/api/blog/unsubscribe?t=${m.token}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } }
        : {}),
    }));
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(batch),
    });
    if (res.ok) sent += batch.length;
    else errors.push(`${res.status} ${await res.text()}`);
  }
  return { sent, errors };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Confirms or unsubscribes by the emailed token. */
export async function setSubscription(token: string, action: "confirm" | "unsubscribe"): Promise<boolean> {
  if (!UUID.test(token)) return false;
  const patch = action === "confirm" ? { confirmed: true, unsubscribed: false, confirmed_at: new Date().toISOString() } : { unsubscribed: true };
  try {
    const rows = await rest<unknown[]>(`blog_subscribers?token=eq.${token}`, { method: "PATCH", body: JSON.stringify(patch), prefer: "return=representation" });
    return rows.length > 0;
  } catch {
    return false;
  }
}
