// What a profile contains. One shape for three jobs: what Claude returns when it reads a
// resume, what the editor edits, and what the server validates before saving.
import { z } from "zod";

const month = (what: string) => z.string().describe(`${what} as YYYY-MM, or "" if unknown`);

/** Field shapes without length limits (structured output accepts these as-is). */
function shapes<Status extends z.ZodType>(
  text: (max: number) => z.ZodString,
  list: <T extends z.ZodType>(item: T, max: number) => z.ZodArray<T>,
  status: Status,
) {
  const experience = z.object({
    title: text(120).describe("Job title"),
    company: text(120),
    location: text(120).describe('City and country, "Remote", or ""'),
    start: month("Start month"),
    end: month('End month ("" if current)'),
    current: z.boolean().describe("True if they still work here"),
    bullets: list(text(400), 12).describe("Achievements and responsibilities, one per item, as written"),
    skills: list(text(60), 20).describe("Tools, languages and methods used in this role"),
  });
  const education = z.object({
    school: text(160),
    degree: text(120).describe('e.g. "MS", "BSc", "Bootcamp certificate"'),
    field: text(120),
    start: text(4).describe('Start year YYYY, or ""'),
    end: text(4).describe('End year YYYY (expected, if still studying), or ""'),
  });
  const project = z.object({
    name: text(120),
    url: text(300).describe('Repo or demo link, or ""'),
    summary: text(400).describe("What it does and the result, one or two sentences"),
    skills: list(text(60), 15),
  });
  const certification = z.object({
    name: text(160),
    issuer: text(120),
    issued: month("Issue month"),
    expires: month("Expiry month"),
    credentialId: text(120),
    url: text(300).describe('Verification link, or ""'),
  });
  return {
    full_name: text(120),
    headline: text(140).describe('Short professional headline, e.g. "Data Engineer · streaming pipelines"'),
    location: text(120).describe('Current city and country, or ""'),
    status,
    links: list(z.object({ label: text(40).describe('e.g. "GitHub", "LinkedIn", "Portfolio"'), url: text(300) }), 8),
    resume: z.object({
      experience: list(experience, 20).describe("Most recent first"),
      education: list(education, 10),
      projects: list(project, 15),
      certifications: list(certification, 20),
      skills: list(text(60), 60).describe("All distinct technical skills, tools and languages, most important first"),
    }),
  };
}

/**
 * Sent to Claude as the output format for resume reading. Structured outputs don't enforce
 * enums, so status is free text here and mapped to "student" | "professional" afterwards.
 */
export const ResumeDraftSchema = z.object(
  shapes(
    () => z.string(),
    (item) => z.array(item),
    z.string().describe('"student" only if currently studying and not yet in a full-time role, otherwise "professional"'),
  ),
);

/** What the server accepts when someone saves their profile (bounded sizes). */
export const ProfileSaveSchema = z.object(
  shapes(
    (max) => z.string().trim().max(max),
    (item, max) => z.array(item).max(max),
    z.enum(["student", "professional"]),
  ),
);

export type ProfileData = z.infer<typeof ProfileSaveSchema>;
export type Experience = ProfileData["resume"]["experience"][number];

export const emptyProfile: ProfileData = {
  full_name: "",
  headline: "",
  location: "",
  status: "professional",
  links: [],
  resume: { experience: [], education: [], projects: [], certifications: [], skills: [] },
};

/** Fills gaps in a stored profile (older rows, partial drafts) so the editor always gets every field. */
export function withDefaults(p: Partial<ProfileData> & { resume?: Partial<ProfileData["resume"]> }): ProfileData {
  return {
    ...emptyProfile,
    ...p,
    links: p.links ?? [],
    resume: { ...emptyProfile.resume, ...(p.resume ?? {}) },
  };
}
