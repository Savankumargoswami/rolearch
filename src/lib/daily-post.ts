// Daily Rolearch posts and the weekly newsletter: templated from jobs_digest (db/024_daily_posts.sql), no AI.
import "server-only";

export const SITE = "https://www.rolearch.com";

export type DigestJob = {
  id: string;
  title: string;
  company: string;
  city: string;
  workplace: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: string | null;
};
export type Digest = { total: number; companies: number; jobs: DigestJob[]; skills: string[]; cities: string[] };

type Topic = { key: string; title: string; noun: string; query: Record<string, string> };

const cat = (key: string, title: string, noun: string): Topic => ({ key, title, noun, query: { cat: key } });

/** One topic a day, in this order; a fortnight before it repeats. */
export const TOPICS: Topic[] = [
  { key: "new", title: "New US jobs today", noun: "new US jobs", query: {} },
  { key: "remote", title: "Remote jobs posted today", noun: "remote US jobs", query: { remote: "1" } },
  cat("software", "Software engineering jobs", "software jobs"),
  cat("healthcare", "Healthcare jobs", "healthcare jobs"),
  { key: "visa", title: "Jobs that sponsor visas", noun: "visa-sponsoring jobs", query: { visa: "1" } },
  cat("data", "Data and AI jobs", "data and AI jobs"),
  { key: "pay", title: "Jobs that show the pay", noun: "jobs with posted salaries", query: { pay: "1" } },
  cat("trades", "Skilled trades jobs", "skilled trades jobs"),
  cat("finance", "Finance and accounting jobs", "finance jobs"),
  cat("engineering", "Engineering jobs", "engineering jobs"),
  cat("education", "Teaching and education jobs", "education jobs"),
  cat("sales", "Sales jobs", "sales jobs"),
  cat("driving", "Driving and delivery jobs", "driving jobs"),
  cat("marketing", "Marketing jobs", "marketing jobs"),
];

export const topicFor = (date: Date) => TOPICS[Math.floor(date.getTime() / 86_400_000) % TOPICS.length];

export function searchUrl(topic: Topic) {
  const sp = new URLSearchParams({ ...topic.query, where: "north-america", sort: "newest" });
  return `${SITE}/jobs?${sp}`;
}

const nf = new Intl.NumberFormat("en-US");
const k = (n: number) => (n >= 1000 ? `$${Math.round(n / 1000)}k` : `$${nf.format(Math.round(n))}`);

export function pay(j: DigestJob) {
  if (!j.salary_min && !j.salary_max) return "";
  const lo = j.salary_min ?? j.salary_max!;
  const hi = j.salary_max ?? lo;
  const range = lo === hi ? k(lo) : `${k(lo)}–${k(hi)}`;
  return j.salary_period === "hour" ? `${range.replaceAll("k", "")}/hr` : range;
}

const where = (j: DigestJob) => (j.workplace === "remote" ? "Remote" : j.city ? titleCase(j.city) : "");
const titleCase = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()) : s);

/** The post body (at most 2,000 characters). Job lines are [label](/jobs/id) links, which the post card renders. */
export function dailyPost(topic: Topic, d: Digest, since: "24 hours" | "week"): { body: string; link: string } | null {
  if (d.total < 5 || d.jobs.length < 3) return null;
  const lines = [
    `${topic.title}`,
    `${nf.format(d.total)}${d.total >= 20000 ? "+" : ""} ${topic.noun} posted in the last ${since} by ${nf.format(d.companies)} employers, straight from their own career sites. No staffing agencies, no reposts.`,
    "",
    "Picks:",
    ...d.jobs.slice(0, 5).map((j) => `• [${[j.title, j.company, where(j), pay(j)].filter(Boolean).join(" · ")}](/jobs/${j.id})`),
  ];
  if (d.skills.length >= 3) lines.push("", `Most requested skills: ${d.skills.slice(0, 6).join(", ")}`);
  if (d.cities.length >= 3 && topic.key !== "remote") lines.push(`Hiring most in: ${d.cities.slice(0, 4).join(", ")}`);
  lines.push("", "Check your resume against any of them with the free ATS scan.");
  let body = lines.join("\n");
  while (body.length > 2000) body = body.slice(0, body.lastIndexOf("\n•"));
  return { body, link: searchUrl(topic) };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

export type Section = { topic: Topic; digest: Digest };

/** The weekly email: a few sections of the week's best new jobs, then the skills employers asked for most. */
export function newsletterHtml(sections: Section[], skills: string[], unsubscribe: string) {
  const blocks = sections
    .filter((s) => s.digest.jobs.length > 0)
    .map(({ topic, digest }) => {
      const rows = digest.jobs
        .slice(0, 5)
        .map((j) => {
          const meta = [j.company, where(j), pay(j)].filter(Boolean).map(esc).join(" · ");
          return `<tr><td style="padding:8px 0;border-bottom:1px solid #e6e6e6"><a href="${SITE}/jobs/${encodeURIComponent(j.id)}" style="color:#1B2A3A;font-weight:600;text-decoration:none">${esc(j.title)}</a><div style="color:#555;font-size:13px">${meta}</div></td></tr>`;
        })
        .join("");
      return `<h2 style="font-size:17px;margin:28px 0 4px">${esc(topic.title)} this week</h2>
<p style="margin:0 0 6px;color:#555;font-size:13px">${nf.format(digest.total)}${digest.total >= 20000 ? "+" : ""} ${esc(topic.noun)} from ${nf.format(digest.companies)} employers</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${rows}</table>
<p style="margin:8px 0 0"><a href="${searchUrl(topic)}" style="color:#1B2A3A">See all ${esc(topic.noun)} →</a></p>`;
    })
    .join("");
  const skillLine = skills.length ? `<h2 style="font-size:17px;margin:28px 0 4px">Skills employers asked for most</h2><p style="margin:0;color:#333">${skills.map(esc).join(", ")}</p>` : "";
  return `<!doctype html><html><body style="margin:0;background:#f6f6f4">
<div style="max-width:600px;margin:0 auto;padding:28px 20px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;background:#fff">
<p style="margin:0;font-size:22px;font-weight:700;color:#1B2A3A">Rolearch weekly</p>
<p style="margin:6px 0 0;color:#555">New jobs straight from employers' own career sites. No staffing agencies, no reposts.</p>
${blocks}
${skillLine}
<p style="margin:28px 0 0"><a href="${SITE}/ats" style="display:inline-block;background:#1B2A3A;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">Scan your resume for free</a></p>
<p style="margin:28px 0 0;color:#888;font-size:12px">You get this because you turned on the weekly email in your Rolearch account. <a href="${unsubscribe}" style="color:#888">Unsubscribe</a></p>
</div></body></html>`;
}
