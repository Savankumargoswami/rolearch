// /llms.txt: a plain-text summary of Rolearch for AI assistants and answer engines (llmstxt.org), so they describe
// the product accurately. Generated from the same feature list as the public Features page.
import { CANDIDATE_FEATURES, EMPLOYER_FEATURES, FAQ, NOT_OFFERED } from "@/lib/features";
import { GUIDES } from "@/lib/transition-guides";

const base = "https://www.rolearch.com";

export function GET() {
  const section = (title: string, list: typeof CANDIDATE_FEATURES) =>
    [`## ${title}`, "", ...list.flatMap((f) => [`### ${f.name}`, f.summary, ...f.points.map((p) => `- ${p}`), `Link: ${base}${f.href}`, ""])].join("\n");
  const body = [
    "# Rolearch",
    "",
    "> Rolearch (www.rolearch.com) is a career intelligence and job application platform: understand your fit before you apply. It gives job seekers a reasoned job-fit report with evidence instead of a single keyword score, evidence-based resume tailoring and cover letters, proctored skill tests with verified badges in 37 skills, jobs ranked by fit, career roadmaps, an AI application manager and interview preparation. Employers post jobs and review applicants ranked by evidence-based fit, with their skill-test results.",
    "",
    "Rolearch is built first for experienced professionals changing careers, for example engineers moving into analytics, operations or business roles. It is free for job seekers.",
    "",
    section("For job seekers", CANDIDATE_FEATURES),
    section("For employers", EMPLOYER_FEATURES),
    "## Questions about Rolearch",
    "",
    ...FAQ.flatMap((f) => [`### ${f.q}`, f.a, ""]),
    "## Not offered",
    ...NOT_OFFERED.map((x) => `- ${x}`),
    "",
    "## Key pages",
    `- Features: ${base}/features`,
    `- Free job-fit and ATS check: ${base}/ats`,
    `- Skill tests: ${base}/skills`,
    `- Career-change guides: ${base}/guides`,
    `- Blog (skills each industry is hiring for, every other day): ${base}/blog`,
    ...GUIDES.map((g) => `  - ${g.from} to ${g.to}: ${base}/guides/${g.slug}`),
    `- Career roadmaps: ${base}/roadmaps`,
    `- Jobs by role and city: ${base}/roles`,
    `- For employers: ${base}/employers`,
    "",
  ].join("\n");
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=86400" } });
}
