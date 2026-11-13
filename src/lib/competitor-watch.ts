// Competitor watch: once a week, research what each competitor shipped or announced in the last seven days (features,
// pricing, launches, funding, partnerships, notable posts), compare with last week's notes, and write a short
// "what this means for Rolearch". Like the blog writer, every item must link to a page the research actually opened.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";

const MODEL = "claude-sonnet-5-5";

export type Competitor = { key: string; name: string; site: string; what: string };
export const COMPETITORS: Competitor[] = [
  { key: "teal", name: "Teal", site: "tealhq.com", what: "resume builder, job tracker and career tools" },
  { key: "jobscan", name: "Jobscan", site: "jobscan.co", what: "ATS resume scanner and optimizer" },
  { key: "huntr", name: "Huntr", site: "huntr.co", what: "job application tracker and AI resume tools" },
  { key: "simplify", name: "Simplify", site: "simplify.jobs", what: "autofill applications, job matching and resume tools" },
  { key: "rezi", name: "Rezi", site: "rezi.ai", what: "AI resume builder" },
  { key: "kickresume", name: "Kickresume", site: "kickresume.com", what: "AI resume and cover letter builder" },
  { key: "jobright", name: "Jobright", site: "jobright.ai", what: "AI job matching and job-search copilot" },
  { key: "careerflow", name: "Careerflow", site: "careerflow.ai", what: "AI career copilot, LinkedIn and resume tools" },
];

const KINDS = ["feature", "pricing", "launch", "funding", "partnership", "content", "other"] as const;
const ChangeSchema = z.object({
  kind: z.enum(KINDS),
  title: z.string().describe("What changed, in under 12 words"),
  detail: z.string().describe("One or two plain sentences: what it does and who it is for"),
  date: z.string().describe("YYYY-MM-DD when announced or first seen, or empty if unknown"),
  url: z.string().describe("The source page, copied exactly from the research notes"),
  confirmed: z.boolean().describe("true when the page shows it happened inside the window; false when it is likely new but the date is unclear"),
});
const ReportSchema = z.object({
  changes: z.array(ChangeSchema).describe("Changes from the last 7 days that the notes support (confirmed), plus ones the notes call likely new with an unclear date (not confirmed); [] when there are none"),
  pricing: z.string().describe("Current pricing in one line (plans and prices) if the notes show it, else empty"),
});
export type Change = z.infer<typeof ChangeSchema>;
export type Report = z.infer<typeof ReportSchema> & { competitor: string; sources: number };

const RESEARCH_SYSTEM = `You are a competitive-intelligence analyst for Rolearch (rolearch.com), a free career platform:
job search across employers' own career pages, job-fit scoring against a person's real experience, a free ATS resume
check, evidence-based resume tailoring, proctored skill tests with badges, a Chrome extension and an application tracker.

Research one competitor's news from the last 7 days with web search: product launches and new features, pricing or plan
changes, funding, acquisitions, partnerships, big marketing pushes, notable blog posts or reports, and changes to their
homepage claims. Search recent press and news, and open their own pages with web fetch: the homepage, the pricing page,
and the changelog, release notes or blog index (try the obvious paths, such as /pricing, /changelog, /blog). Note their
current pricing.
Be strict about dates: only count something as new if the page shows it was published or announced in the window; say
so when a date is unclear. Write short research notes: each finding with its date and the URL it came from. If nothing
notable happened, say that plainly. Do not speculate.`;

const norm = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
};

/** Research and structure one competitor's week. Changes whose source the research didn't open are dropped. */
async function watchOne(client: Anthropic, c: Competitor, since: string, today: string, lastWeek: string): Promise<Report> {
  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: `Competitor: ${c.name} (${c.site}), ${c.what}.\nWindow: ${since} to ${today}.\nLast week's notes (don't repeat these as new): ${lastWeek || "none"}`,
    },
  ];
  const urls = new Map<string, string>();
  let notes = "";
  for (let turn = 0; turn < 3; turn++) {
    const msg = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 8000,
        thinking: { type: "adaptive" },
        output_config: { effort: "low" },
        system: RESEARCH_SYSTEM,
        // Basic search: every result URL comes back in the response, so sources can be checked.
        tools: [
          { type: "web_search_20250305", name: "web_search", max_uses: 5 },
          // Reads the competitor's own pages (homepage, pricing, changelog, blog), limited to their domain.
          { type: "web_fetch_20250910", name: "web_fetch", max_uses: 4, allowed_domains: [c.site], max_content_tokens: 12000 },
        ],
        messages,
      })
      .finalMessage();
    for (const block of msg.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") urls.set(norm(r.url), r.url);
      }
      if (block.type === "web_fetch_tool_result" && block.content.type === "web_fetch_result") urls.set(norm(block.content.url), block.content.url);
      if (block.type === "text") {
        notes += block.text;
        for (const cit of block.citations ?? []) if (cit.type === "web_search_result_location") urls.set(norm(cit.url), cit.url);
      }
    }
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }

  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    output_config: { effort: "low", format: zodOutputFormat(ReportSchema) },
    system:
      "Turn the research notes into a structured report. Include changes from the window that the notes support (confirmed: true) and items the notes call likely new but undated (confirmed: false). Leave out anything the notes say is older than the window, and third-party coupon or review-count pages. Each item needs a URL copied exactly from the notes. Never invent changes, dates or URLs.",
    messages: [
      {
        role: "user",
        content: `Competitor: ${c.name}\nWindow: ${since} to ${today}\n\nResearch notes:\n${notes}\n\nURLs the research opened (the only sources you may use):\n${[...urls.values()].map((u) => `- ${u}`).join("\n")}`,
      },
    ],
  });
  const parsed = res.parsed_output ?? { changes: [], pricing: "" };
  const changes = parsed.changes.filter((ch) => urls.has(norm(ch.url))).map((ch) => ({ ...ch, url: urls.get(norm(ch.url)) ?? ch.url }));
  return { competitor: c.key, changes, pricing: parsed.pricing, sources: urls.size };
}

/** What the week's changes mean for Rolearch: a few concrete, honest bullets. */
async function takeaways(client: Anthropic, reports: Report[]): Promise<string[]> {
  const news = reports
    .filter((r) => r.changes.length)
    .map((r) => `${COMPETITORS.find((c) => c.key === r.competitor)?.name}: ${r.changes.map((c) => `[${c.kind}] ${c.title}: ${c.detail}`).join(" | ")}`)
    .join("\n");
  if (!news) return [];
  const res = await client.messages.parse({
    model: MODEL,
    max_tokens: 2000,
    output_config: { effort: "low", format: zodOutputFormat(z.object({ bullets: z.array(z.string()).describe("2-5 bullets, each one sentence") })) },
    system:
      "You advise Rolearch's founder. From this week's competitor changes, say what matters for Rolearch: threats, gaps worth closing, ideas worth copying, or things to ignore. Be specific and honest, one sentence each. Rolearch: free job search from employers' career pages, job-fit scores from real experience, free ATS check, evidence-only resume tailoring (never invents), proctored skill badges, Chrome extension, application tracker.",
    messages: [{ role: "user", content: news }],
  });
  return res.parsed_output?.bullets ?? [];
}

/** Run every competitor in parallel (one slow site doesn't hold up the rest). */
export async function runWatch(lastWeek: Record<string, string>): Promise<{ reports: Report[]; takeaways: string[]; failed: string[] }> {
  const client = new Anthropic();
  const today = new Date();
  const since = new Date(today.getTime() - 7 * 86_400_000).toISOString().slice(0, 10);
  const settled = await Promise.allSettled(COMPETITORS.map((c) => watchOne(client, c, since, today.toISOString().slice(0, 10), lastWeek[c.key] ?? "")));
  const reports: Report[] = [];
  const failed: string[] = [];
  settled.forEach((s, i) => (s.status === "fulfilled" ? reports.push(s.value) : failed.push(COMPETITORS[i].name)));
  return { reports, takeaways: await takeaways(client, reports).catch(() => []), failed };
}

const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]!);
const safeUrl = (u: string) => (/^https?:\/\//.test(u) ? esc(u) : "#");

/** The email: takeaways first, then each competitor with news, then the quiet ones in one line. */
export function watchEmail(week: string, r: { reports: Report[]; takeaways: string[]; failed: string[] }) {
  const name = (k: string) => COMPETITORS.find((c) => c.key === k)?.name ?? k;
  const busy = r.reports.filter((x) => x.changes.length);
  const quiet = r.reports.filter((x) => !x.changes.length).map((x) => name(x.competitor));
  const total = busy.reduce((a, x) => a + x.changes.length, 0);
  const html = `<div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;color:#0e1f2f">
<h1 style="font-size:22px;margin:0 0 4px">Competitor watch · week of ${esc(week)}</h1>
<p style="color:#4b5a6e;margin:0 0 20px">${total} change${total === 1 ? "" : "s"} across ${busy.length} of ${r.reports.length} competitors in the last 7 days.</p>
${r.takeaways.length ? `<h2 style="font-size:16px;margin:0 0 8px">What it means for Rolearch</h2><ul style="margin:0 0 22px;padding-left:20px">${r.takeaways.map((b) => `<li style="margin:0 0 6px">${esc(b)}</li>`).join("")}</ul>` : ""}
${busy
  .map(
    (x) => `<h2 style="font-size:16px;margin:18px 0 6px">${esc(name(x.competitor))}</h2>
<ul style="margin:0;padding-left:20px">${x.changes
      .map(
        (c) =>
          `<li style="margin:0 0 8px"><span style="display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.06em;background:#f6e7d3;color:#8f5b12;border-radius:4px;padding:1px 6px;margin-right:6px">${esc(c.kind)}</span><b>${esc(c.title)}</b>${c.date ? ` <span style="color:#4b5a6e">(${esc(c.date)})</span>` : ""}${c.confirmed ? "" : ` <span style="color:#b4532a;font-size:12px">date unclear</span>`}<br>${esc(c.detail)} <a href="${safeUrl(c.url)}" style="color:#8f5b12">Source</a></li>`,
      )
      .join("")}</ul>${x.pricing ? `<p style="color:#4b5a6e;font-size:13px;margin:4px 0 0">Pricing: ${esc(x.pricing)}</p>` : ""}`,
  )
  .join("\n")}
${quiet.length ? `<p style="color:#4b5a6e;margin:22px 0 0">No notable changes: ${esc(quiet.join(", "))}.</p>` : ""}
${r.failed.length ? `<p style="color:#b4532a;margin:8px 0 0">Couldn't check this week: ${esc(r.failed.join(", "))}.</p>` : ""}
<p style="color:#4b5a6e;font-size:12px;margin:28px 0 0">Researched on the live web; each item links to the page it came from. Rolearch competitor watch, every Monday.</p>
</div>`;
  return { subject: `Competitor watch: ${total} change${total === 1 ? "" : "s"} this week${busy.length ? ` (${busy.map((x) => name(x.competitor)).join(", ")})` : ""}`, html };
}
