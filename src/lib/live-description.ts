// A job's full description, read from the employer's own posting when the refresh hasn't stored it yet.
// The refresh reads a limited number of descriptions per employer per run, so many jobs arrive with only a title;
// the ATS check fetches the one job someone wants to scan, through the same public endpoints the refresh uses
// (or the posting page's schema.org JobPosting data, when robots.txt allows us), and saves it for next time.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicHttps } from "./feed-check";

const UA = "RolearchBot/0.1 (+https://rolearch.com/bot; admin@rolearch.com)";
const TIMEOUT_MS = 12_000;
const MAX_CHARS = 20_000;

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“", ndash: "–", mdash: "—", bull: "•", hellip: "…" };

/** HTML to readable plain text: block tags become line breaks, list items become dashes. */
export function htmlToText(html: string): string {
  // Some feeds encode their HTML twice ("&lt;p&gt;"): decode the markup first so it's stripped, not shown.
  if (/&lt;\/?[a-z]/i.test(html) && !/<\/?(p|div|br|li)\b/i.test(html)) html = html.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<br\s*\/?>|<\/(p|div|h[1-6]|li|ul|ol|tr)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(Number.parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m)
    .replace(/[ \t ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function get(url: string, init: RequestInit = {}): Promise<Response | null> {
  try {
    return await fetch(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json, text/html;q=0.9", ...init.headers }, signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
  } catch {
    return null;
  }
}

async function json(url: string, init: RequestInit = {}): Promise<Record<string, unknown> | null> {
  const res = await get(url, init);
  if (!res?.ok) return null;
  try {
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});
const str = (v: unknown) => (typeof v === "string" ? v : "");

/** Does robots.txt let us read this page? A missing or unreadable robots.txt allows everything. */
async function allowed(url: URL): Promise<boolean> {
  const res = await get(`${url.origin}/robots.txt`);
  if (!res?.ok) return true;
  const rules: { allow: boolean; path: string }[] = [];
  let applies = false;
  let inGroup = false;
  for (const raw of (await res.text()).split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const [key, value] = [m[1].toLowerCase(), m[2].trim()];
    if (key === "user-agent") {
      if (!inGroup) applies = false;
      inGroup = true;
      if (value === "*" || /rolearch/i.test(value)) applies = true;
    } else {
      inGroup = false;
      if (applies && (key === "allow" || key === "disallow") && value) rules.push({ allow: key === "allow", path: value });
    }
  }
  const path = url.pathname + url.search;
  const match = (p: string) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\\\$$/, "$")}`).test(path);
  const hit = rules.filter((r) => match(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
  return hit ? hit.allow : true;
}

/** schema.org JobPosting description from a page's JSON-LD. */
function jsonLdDescription(html: string): string {
  for (const m of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack = [data];
    while (stack.length) {
      const node = stack.pop();
      if (Array.isArray(node)) stack.push(...node);
      else if (node && typeof node === "object") {
        const o = node as Obj;
        const type = o["@type"];
        if ((type === "JobPosting" || (Array.isArray(type) && type.includes("JobPosting"))) && str(o.description)) return htmlToText(str(o.description));
        stack.push(...Object.values(o).filter((v) => v && typeof v === "object"));
      }
    }
  }
  return "";
}

/** Inner HTML of the span/div that opens at `start`, matching nested span/div tags. */
function element(page: string, start: number): string {
  const tag = /<(\/?)(span|div)\b[^>]*?(\/?)>/gi;
  tag.lastIndex = start;
  let depth = 0;
  let bodyStart = -1;
  for (let m = tag.exec(page); m; m = tag.exec(page)) {
    if (m[3]) continue;
    if (bodyStart < 0) bodyStart = m.index + m[0].length;
    depth += m[1] ? -1 : 1;
    if (depth === 0) return page.slice(bodyStart, m.index);
  }
  return page.slice(bodyStart < 0 ? start : bodyStart);
}

/** schema.org microdata (itemprop="description"); pages can carry several blocks, so keep the fullest. */
function microdataDescription(html: string): string {
  const blocks = [...html.matchAll(/<(span|div)[^>]*itemprop="description"/gi)].map((m) => htmlToText(element(html, m.index)));
  return blocks.sort((a, b) => b.length - a.length)[0] ?? "";
}

/** Taleo keeps the posting in a script call: its '!*!'-prefixed strings are the description's parts. */
function taleoDescription(html: string): string {
  const m = /api\.fillList\('requisitionDescriptionInterface',\s*'descRequisition',\s*\[([\s\S]*?)\]\);/.exec(html);
  if (!m) return "";
  const parts = [...new Set([...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map((x) => x[1]).filter((v) => v.startsWith("!*!")))];
  return htmlToText(parts.map((v) => { try { return decodeURIComponent(v.slice(3)); } catch { return v.slice(3); } }).join("\n"));
}

/** Avature job pages: the description is in "article--details" blocks (the ones that aren't label/value fields). */
function avatureDescription(html: string): string {
  return [...html.matchAll(/<article class="article article--details[\s\S]*?<\/article>/g)]
    .map((m) => m[0])
    .filter((b) => !/__field__label">/.test(b))
    .map((b) => htmlToText(b.replace(/<h3[^>]*class="article__header__text__title[^"]*"[\s\S]*?<\/h3>/g, " ")))
    .filter((t) => t.length > 80)
    .join("\n\n");
}

/** Phenom pages can leave the JSON-LD description empty and keep it in the page's own data as "jobDescription". */
function embeddedDescription(html: string): string {
  const found = [...html.matchAll(/"jobDescription":"((?:[^"\\]|\\.)*)"/g)].map((m) => {
    try {
      return htmlToText(JSON.parse(`"${m[1]}"`) as string);
    } catch {
      return "";
    }
  });
  return found.sort((a, b) => b.length - a.length)[0] ?? "";
}

async function fromPage(raw: string, query = ""): Promise<string> {
  const url = await publicHttps(raw);
  if (!url) return "";
  if (query) url.search = url.search ? `${url.search}&${query}` : `?${query}`;
  if (!(await allowed(url))) return "";
  const res = await get(url.toString(), { headers: { Accept: "text/html" } });
  if (!res?.ok) return "";
  const html = await res.text();
  return [jsonLdDescription(html), microdataDescription(html), taleoDescription(html), avatureDescription(html), embeddedDescription(html)].sort((a, b) => b.length - a.length)[0];
}

/** The description for one job, by the system its link belongs to. Empty when it can't be read. */
export async function read(jobUrl: string, companyKey: string): Promise<string> {
  let u: URL;
  try {
    u = new URL(jobUrl);
  } catch {
    return "";
  }
  const host = u.hostname.toLowerCase();

  // Workday: /en-US/{site}/job/{path} -> /wday/cxs/{tenant}/{site}/job/{path}
  const wd = /^([\w-]+)\.wd\d+\.myworkdayjobs\.com$/.exec(host);
  const wdPath = /^\/(?:[a-z]{2}-[A-Z]{2}\/)?([^/]+)(\/job\/.+)$/.exec(u.pathname);
  if (wd && wdPath) {
    const d = await json(`${u.origin}/wday/cxs/${wd[1]}/${wdPath[1]}${wdPath[2]}`);
    return htmlToText(str(obj(d?.jobPostingInfo).jobDescription));
  }

  // Oracle Recruiting Cloud: /hcmUI/CandidateExperience/{lang}/sites/{site}/job/{id}
  const oc = /\/sites\/([^/]+)\/job\/(\d+)/.exec(u.pathname);
  if (host.endsWith(".oraclecloud.com") && oc) {
    const finder = encodeURIComponent(`ById;Id="${oc[2]}",siteNumber=${oc[1]}`);
    const d = await json(`${u.origin}/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?onlyData=true&expand=all&finder=${finder}`);
    const info = obj((d?.items as unknown[] | undefined)?.[0]);
    return [info.ExternalDescriptionStr, info.ExternalResponsibilitiesStr, info.ExternalQualificationsStr]
      .map((p) => htmlToText(str(p)))
      .filter(Boolean)
      .join("\n\n");
  }

  // Eightfold: /careers/job/{id}; the company's domain is the second half of the board token.
  const ef = /\/careers\/job\/(\d+)/.exec(u.pathname);
  if (host.endsWith("eightfold.ai") && ef) {
    const domain = companyKey.split("|")[1] ?? "";
    const d = await json(`${u.origin}/api/pcsx/position_details?position_id=${ef[1]}&domain=${encodeURIComponent(domain)}&hl=en`);
    return htmlToText(str(obj(d?.data).jobDescription));
  }

  // SmartRecruiters: jobs.smartrecruiters.com/{company}/{id}
  const sr = /^\/([^/]+)\/(\d+)/.exec(u.pathname);
  if (host === "jobs.smartrecruiters.com" && sr) {
    const d = await json(`https://api.smartrecruiters.com/v1/companies/${sr[1]}/postings/${sr[2]}`);
    return Object.values(obj(obj(d?.jobAd).sections))
      .map((s) => htmlToText(str(obj(s).text)))
      .filter(Boolean)
      .join("\n\n");
  }

  // SchoolSpring: www.schoolspring.com/jobs?jobid={id}
  const ss = u.searchParams.get("jobid");
  if (host.endsWith("schoolspring.com") && ss && /^\d+$/.test(ss)) {
    const d = await json(`https://api.schoolspring.com/api/Jobs/${ss}?domainName=www.schoolspring.com`);
    return htmlToText(str(obj(obj(d?.value).jobInfo).jobDescription));
  }

  // ADP Workforce Now: the career center's public requisition endpoint.
  const adp = u.searchParams;
  if (host === "workforcenow.adp.com" && adp.get("cid") && adp.get("jobId")) {
    const q = new URLSearchParams({ cid: adp.get("cid")!, ccId: adp.get("ccId") || "19000101_000001", lang: "en_US", locale: "en_US" });
    const d = await json(`https://workforcenow.adp.com/mascsr/default/careercenter/public/events/staffing/v1/job-requisitions/${encodeURIComponent(adp.get("jobId")!)}?${q}`);
    return htmlToText(str(d?.requisitionDescription));
  }

  // iCIMS shows the posting inside a frame; the framed page carries the JobPosting data.
  if (host.endsWith(".icims.com")) return fromPage(jobUrl, "in_iframe=1");

  // Everything else (Phenom, SuccessFactors, Taleo, Avature, sitemap boards ...): the page's JobPosting data.
  return fromPage(jobUrl);
}

/** Read live and kept for weeks. Throws when nothing usable came back, so a failed read isn't cached. */
async function cachedDescription(jobId: string, jobUrl: string, companyKey: string): Promise<string> {
  "use cache";
  cacheLife("weeks");
  cacheTag(`job-text-${jobId}`);
  const text = (await read(jobUrl, companyKey)).slice(0, MAX_CHARS);
  if (text.length < 200) throw new Error("no description");
  return text;
}

/** The full description of a stored job from the employer's own posting, saved for next time; "" if it can't be read. */
export async function liveDescription(jobId: string, jobUrl: string): Promise<string> {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!base || !key || !jobUrl) return "";
  let companyKey = "";
  try {
    const res = await fetch(`${base}/rest/v1/jobs?select=company_key&id=eq.${encodeURIComponent(jobId)}`, { headers: { apikey: key }, cache: "no-store" });
    companyKey = res.ok ? (((await res.json()) as { company_key: string }[])[0]?.company_key ?? "") : "";
  } catch {}
  let text = "";
  try {
    text = await cachedDescription(jobId, jobUrl, companyKey);
  } catch {
    return "";
  }
  // Keep it with the job (db/025_live_descriptions.sql); a failed save only means it's read live again later.
  const secret = process.env.POST_REVIEW_SECRET;
  if (secret) {
    await fetch(`${base}/rest/v1/rpc/save_job_description`, {
      method: "POST",
      headers: { apikey: key, "Content-Type": "application/json" },
      body: JSON.stringify({ p_secret: secret, p_id: jobId, p_description: text }),
      cache: "no-store",
    }).catch(() => null);
  }
  return text;
}
