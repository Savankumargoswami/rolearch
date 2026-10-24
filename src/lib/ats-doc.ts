// The resume the ATS check works on: a profile plus the parts a real resume has that a profile doesn't
// (a written summary, skills grouped under labels, and any other text such as a keywords line).
// Keeping them means the scan reads the whole resume, as a scanner would, and the download keeps them.
import { z } from "zod";
import { ProfileSaveSchema, shapes, type ProfileData } from "./profile-schema";

export const SkillGroupSchema = z.object({ label: z.string().trim().max(100), items: z.array(z.string().trim().max(120)).max(40) });

// Real resumes run longer than profile fields (a bullet can be a whole paragraph), so the ATS check accepts
// several times the profile's limits; what it can't accept is unbounded input.
export const AtsDocSchema = z.object(
  shapes(
    (max) => z.string().trim().max(max * 4),
    (item, max) => z.array(item).max(max * 3),
    z.enum(["student", "professional"]),
  ),
).extend({
  summary: z.string().trim().max(2000).default(""),
  skill_groups: z.array(SkillGroupSchema).max(12).default([]),
  extra: z.string().trim().max(3000).default(""),
  /** One details line per degree, same order as resume.education (GPA, coursework, honours). */
  education_notes: z.array(z.string().trim().max(400)).max(10).default([]),
  /** Extra lines in the resume's header under the contact details (work authorisation, credentials). */
  header_lines: z.array(z.string().trim().max(200)).max(4).default([]),
});

export type AtsDoc = z.infer<typeof AtsDocSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;

export const fromProfile = (p: ProfileData): AtsDoc => ({ ...p, summary: "", skill_groups: [], extra: "", education_notes: [], header_lines: [] });

/** The value made to fit a schema's length limits: over-long text and lists are shortened rather than refused. */
export function fit<T>(schema: z.ZodType<T>, input: unknown): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- walking the value by the error paths
  const value: any = structuredClone(input);
  for (let i = 0; i < 200; i++) {
    const res = schema.safeParse(value);
    if (res.success) return res.data;
    for (const issue of res.error.issues) {
      if (issue.code !== "too_big") throw res.error;
      const key = issue.path[issue.path.length - 1] as string;
      const parent = issue.path.slice(0, -1).reduce((node, k) => node[k as string], value);
      const v = parent[key];
      parent[key] = typeof v === "string" ? v.slice(0, Number(issue.maximum)).trim() : v.slice(0, Number(issue.maximum));
    }
  }
  return schema.parse(value);
}

/** Just the profile fields, for saving a tailored resume back to the member's profile. */
export function toProfile(d: AtsDoc): ProfileData {
  // Profile education dates are years: "Jan 2022" or "2022-01" become "2022".
  const year = (v: string) => /(19|20)\d{2}/.exec(v)?.[0] ?? "";
  const education = d.resume.education.map((e) => ({ ...e, start: year(e.start), end: year(e.end) }));
  return fit(ProfileSaveSchema, { ...d, resume: { ...d.resume, education } });
}
