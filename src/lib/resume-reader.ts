// Reads a resume with Claude and returns a profile draft for the person to review.
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { ResumeDraftSchema, type ProfileData } from "./profile-schema";


export const resumeReaderEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

// Claude Haiku 5.5: the project plan's model for parsing and drafting profiles.
const MODEL = "claude-haiku-5-5";

const SYSTEM = `You turn a resume into structured profile data for Rolearch, a jobs site.
Copy facts from the resume; never invent employers, dates, numbers, links or skills that aren't in it.
Write dates as YYYY-MM (or YYYY for education); use "" when the resume doesn't say.
Keep bullet text as written, only fixing obvious formatting. For each role, list the skills, tools and languages the role's own text mentions.
Write a short headline from the most recent role and focus, in the style "Data Engineer · streaming pipelines".`;

/** Contact details aren't part of the public profile, but the ATS check needs them. */
const ReadSchema = ResumeDraftSchema.extend({
  contact: z.object({ email: z.string().describe('Email address, or ""'), phone: z.string().describe('Phone number as written, or ""') }),
});

export type Contact = { email: string; phone: string };
export type ReadResult = { draft: ProfileData; contact: Contact } | { error: "refused" | "too_long" | "unreadable" | "unavailable" };

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
    return { draft: { ...draft, status: draft.status.trim().toLowerCase() === "student" ? "student" : "professional" }, contact };
  } catch (e) {
    if (e instanceof Anthropic.BadRequestError) return { error: "unreadable" }; // e.g. a corrupt or encrypted PDF
    throw e;
  }
}
