// Reads a resume with Claude and returns a profile draft for the person to review.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { AtsDoc } from "./ats-doc";
import { ResumeDraftSchema } from "./profile-schema";


export const resumeReaderEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

// Claude Haiku 5.5: the project plan's model for parsing and drafting profiles.
const MODEL = "claude-haiku-5-5";

const SYSTEM = `You turn a resume into structured profile data for Rolearch, a jobs site.
Copy facts from the resume; never invent employers, dates, numbers, links or skills that aren't in it.
Write dates as YYYY-MM (or YYYY for education); use "" when the resume doesn't say.
Keep bullet text as written, only fixing obvious formatting. For each role, list the skills, tools and languages the role's own text mentions.
A certification, license or degree the resume marks as in progress, pending, planned or expected keeps that status in its name, e.g. "AWS Certified Data Engineer - Associate (in progress, target Aug 2026)"; never list it as if it were earned.
Write a short headline from the most recent role and focus, in the style "Data Engineer · streaming pipelines".
Also copy, word for word: the resume's summary or profile paragraph (summary); its skills exactly as grouped on the page, with each group's label (skill_groups; one group labelled "Skills" if they aren't grouped); and any other text that doesn't fit the fields above, such as a keywords line, coursework, GPA and other details under education, awards, languages or publications (extra), copied as it appears with no labels of your own, and never repeating text already captured in another field (name, headline, contact details, roles, education, certifications). Leave these empty when the resume has none.`;

/** Contact details aren't part of the public profile, but the ATS check needs them. */
const ReadSchema = ResumeDraftSchema.extend({
  summary: z.string().describe('The summary / profile paragraph, verbatim, or ""'),
  skill_groups: z.array(z.object({ label: z.string(), items: z.array(z.string()) })).describe("Skills as grouped on the resume"),
  extra: z.string().describe('Other text not captured elsewhere (keywords line, education details and coursework, awards, languages), verbatim, or ""'),
  contact: z.object({ email: z.string().describe('Email address, or ""'), phone: z.string().describe('Phone number as written, or ""') }),
});

export type Contact = { email: string; phone: string };
export type ReadResult = { draft: AtsDoc; contact: Contact } | { error: "refused" | "too_long" | "unreadable" | "unavailable" };

export async function readResume(file: { bytes: Buffer; kind: "pdf" | "docx" }): Promise<ReadResult> {
  if (!resumeReaderEnabled) return { error: "unavailable" };

  let document: Anthropic.DocumentBlockParam;
  if (file.kind === "pdf") {
    document = { type: "document", source: { type: "base64", media_type: "application/pdf", data: file.bytes.toString("base64") } };
  } else {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: file.bytes });
    if (!value.trim()) return { error: "unreadable" };
    document = { type: "document", source: { type: "text", media_type: "text/plain", data: value } };
  }

  const client = new Anthropic();
  try {
    const response = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      output_config: { effort: "medium", format: zodOutputFormat(ReadSchema) },
      messages: [{ role: "user", content: [document, { type: "text", text: "Extract this resume into the profile format." }] }],
    });
    if (response.stop_reason === "refusal") return { error: "refused" };
    if (response.stop_reason === "max_tokens") return { error: "too_long" };
    if (!response.parsed_output) return { error: "unreadable" };
    const { contact, ...draft } = response.parsed_output;
    const status = draft.status.trim().toLowerCase() === "student" ? "student" : "professional";
    const skill_groups = draft.skill_groups
      .map((g) => ({ label: g.label.trim().slice(0, 60), items: g.items.map((i) => i.trim().slice(0, 80)).filter(Boolean).slice(0, 30) }))
      .filter((g) => g.items.length)
      .slice(0, 12);
    return { draft: { ...draft, status, summary: draft.summary.trim().slice(0, 2000), skill_groups, extra: draft.extra.trim().slice(0, 3000) }, contact };
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) return { error: "unreadable" }; // e.g. a corrupt or encrypted PDF
    throw e;
  }
}
