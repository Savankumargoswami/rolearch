// Writes one Rolearch blog article the way a professional labour-market researcher would: first research the question
// on the live web (current reports, surveys, official statistics), then write a sourced, practical article. Rolearch's
// own job data (the skills employers asked for in the last two weeks) is included as first-party evidence.
// Every source in the article must be a page the research actually opened, and links in the body are checked too.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { planFor, type Post } from "./blog";

const MODEL = "claude-sonnet-5-5";

export type Hiring = { total: number; companies: number; skills: string[] };

const RESEARCH_SYSTEM = `You are a senior labour-market researcher preparing evidence for an article on rolearch.com, a career platform.
Research the question with web search. Prefer recent, primary and reputable sources: government statistics (for example
BLS, O*NET, Eurostat, ONS), the World Economic Forum Future of Jobs report, OECD, large employer or LinkedIn/Indeed hiring
research, peer-reviewed or university studies, and established industry bodies. Prefer data from the last 24 months.
Always run at least one search for official statistics on the occupations involved (for example BLS employment
projections or O*NET). Do not rely on Medium, dev.to, personal blogs, course sellers' listicles or vendor marketing;
if a number only appears in such a source, find the original or leave it out.

Write research notes: for each finding, the fact or number, its date, and the URL it came from. Note disagreements
between sources and what is uncertain. Do not write the article yet.`;

const WRITE_SYSTEM = `You are a professional researcher and writer for the Rolearch blog. Turn the research notes into an
article that gives readers the most useful information in the least time.

Rules:
- Answer the question directly in the first paragraph, then go deeper.
- Every number, statistic or claim about research must come from the notes, with its source linked inline as a markdown
  link [short source name](url) using ONLY URLs that appear in the notes. Never invent numbers, studies, quotes or URLs.
- Rolearch's own hiring data is first-party evidence: describe it as "jobs on Rolearch in the last two weeks".
- Be practical: name the specific skills, what level is expected, how people learn them (courses, certifications,
  projects), roughly how long that takes when the sources say so, and how to prove the skill to employers.
- Honest about uncertainty and limits. No hype, no clichés ("in today's fast-paced world"), no filler.
- Write as "we" (Rolearch Research), never "I". American English ("resume", not "CV").
- Prefer official and primary sources over secondary reports; don't cite personal blogs or dev.to/Medium posts.
- Plain English, short paragraphs. Markdown body with "## " section headings (4-7 sections), "### " sub-headings where
  useful, "- " bullet lists and **bold** sparingly. No H1 (the title is shown separately). No tables, images or HTML.
- 1,300-2,000 words.
- End with a section "## What to do next" with 3-5 concrete steps. You may point to Rolearch tools where they genuinely
  help: the free job-fit and ATS check (/ats), proctored skill tests with verified badges (/skills), career roadmaps
  (/roadmaps), career-change guides (/guides), and live jobs (/jobs). Mention them at most once each, without hype, and
  give each link descriptive text, for example [the free job-fit check](/ats), never a bare path like [/ats](/ats).`;

const ArticleSchema = z.object({
  title: z.string().describe("Specific, question-led or answer-led title, 50-90 characters, no clickbait"),
  slug: z.string().describe("lowercase-hyphenated URL slug from the title, max 70 characters"),
  description: z.string().describe("Search-result summary that answers the question, 120-160 characters"),
  key_points: z.array(z.string()).describe("3-5 one-sentence takeaways"),
  body: z.string().describe("The article in markdown, following the rules"),
  faq: z.array(z.object({ q: z.string(), a: z.string() })).describe("3-5 questions readers also ask, each answered in 1-3 sentences"),
  sources: z.array(z.object({ title: z.string(), url: z.string() })).describe("Every source cited in the body, from the notes"),
  skills: z.array(z.string()).describe("The 4-10 specific skills the article recommends"),
});

const norm = (u: string) => {
  try {
    const x = new URL(u);
    return `${x.hostname.replace(/^www\./, "")}${x.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
};

/** Research step: web search, continuing while the server pauses a long turn. Returns the notes and every URL opened. */
async function research(client: Anthropic, question: string, industryName: string, hiring: Hiring | null) {
  const data = hiring?.skills.length
    ? `\n\nRolearch's own data: ${hiring.total.toLocaleString("en-US")} new ${industryName.toLowerCase()} jobs in the last two weeks from ${hiring.companies.toLocaleString("en-US")} employers' career sites. Most requested skills, in order: ${hiring.skills.join(", ")}.`
    : "";
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Question: ${question}\nIndustry: ${industryName}\nToday: ${new Date().toISOString().slice(0, 10)}${data}` },
  ];
  const urls = new Map<string, string>();
  let notes = "";
  for (let turn = 0; turn < 4; turn++) {
    const msg = await client.messages
      .stream({
        model: MODEL,
        max_tokens: 16000,
        thinking: { type: "adaptive" },
        output_config: { effort: "medium" },
        system: RESEARCH_SYSTEM,
        // The basic search tool: it returns every result URL in the response, so sources can be checked (the
        // dynamic-filtering version hides most results inside encrypted code-execution output).
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 8 }],
        messages,
      })
      .finalMessage();
    for (const block of msg.content) {
      if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
        for (const r of block.content) if (r.type === "web_search_result") urls.set(norm(r.url), r.url);
      }
      if (block.type === "text") {
        notes += block.text;
        for (const c of block.citations ?? []) if (c.type === "web_search_result_location") urls.set(norm(c.url), c.url);
      }
    }
    if (msg.stop_reason !== "pause_turn") break;
    messages.push({ role: "assistant", content: msg.content });
  }
  return { notes, urls };
}

/** Allowed links: research URLs and Rolearch pages. Anything else is unlinked, keeping its text. */
function cleanLinks(body: string, allowed: Map<string, string>) {
  return body.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text: string, url: string) => {
    if (/^\/[a-z0-9/_-]*$/i.test(url)) return all;
    const real = allowed.get(norm(url));
    return real ? `[${text}](${real})` : text;
  });
}

export const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70)
    .replace(/-+$/, "");

/** Researches and writes post number n. Throws if the result isn't publishable. */
export async function writePost(n: number, hiring: Hiring | null): Promise<Omit<Post, "published_at">> {
  const { industry, question } = planFor(n);
  const client = new Anthropic();
  const { notes, urls } = await research(client, question, industry.name, hiring);
  if (notes.length < 800 || urls.size < 3) throw new Error(`research too thin (${notes.length} chars, ${urls.size} sources)`);

  const sourceList = [...urls.values()].map((u) => `- ${u}`).join("\n");
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 14000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: zodOutputFormat(ArticleSchema) },
    system: WRITE_SYSTEM,
    messages: [
      {
        role: "user",
        content: `Question to answer: ${question}\nIndustry: ${industry.name}\n\nResearch notes:\n${notes}\n\nURLs the research opened (the only links you may use):\n${sourceList}${
          hiring?.skills.length ? `\n\nRolearch hiring data (last two weeks): ${hiring.total} new jobs from ${hiring.companies} employers; most requested skills: ${hiring.skills.join(", ")}.` : ""
        }`,
      },
    ],
  });
  const a = response.parsed_output;
  if (!a) throw new Error(`no article (${response.stop_reason})`);

  const sources = a.sources.flatMap((s) => {
    const real = urls.get(norm(s.url));
    return real ? [{ title: s.title.slice(0, 200), url: real }] : [];
  });
  const seen = new Set<string>();
  const uniqueSources = sources.filter((s) => (seen.has(s.url) ? false : (seen.add(s.url), true)));
  if (uniqueSources.length < 3) throw new Error(`only ${uniqueSources.length} verified sources`);

  const body = cleanLinks(a.body.replace(/^#\s.*\n+/, ""), urls).trim();
  const words = body.split(/\s+/).length;
  if (words < 900) throw new Error(`article too short (${words} words)`);

  const date = new Date().toISOString().slice(0, 10);
  return {
    slug: `${slugify(a.slug || a.title) || "post"}-${date.replaceAll("-", "").slice(2)}`,
    title: a.title.slice(0, 140),
    description: a.description.slice(0, 320),
    industry: industry.key,
    body,
    key_points: a.key_points.slice(0, 5),
    faq: a.faq.slice(0, 6),
    sources: uniqueSources.slice(0, 25),
    skills: a.skills.slice(0, 10),
    reading_minutes: Math.max(3, Math.round(words / 230)),
  };
}
