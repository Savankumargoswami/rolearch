// The resume the ATS check works on: a profile plus the parts a real resume has that a profile doesn't
// (a written summary, skills grouped under labels, and any other text such as a keywords line).
// Keeping them means the scan reads the whole resume, as a scanner would, and the download keeps them.
import { z } from "zod";
import { ProfileSaveSchema, type ProfileData } from "./profile-schema";

export const SkillGroupSchema = z.object({ label: z.string().trim().max(60), items: z.array(z.string().trim().max(80)).max(30) });

export const AtsDocSchema = ProfileSaveSchema.extend({
  summary: z.string().trim().max(2000).default(""),
  skill_groups: z.array(SkillGroupSchema).max(12).default([]),
  extra: z.string().trim().max(3000).default(""),
});

export type AtsDoc = z.infer<typeof AtsDocSchema>;
export type SkillGroup = z.infer<typeof SkillGroupSchema>;

export const fromProfile = (p: ProfileData): AtsDoc => ({ ...p, summary: "", skill_groups: [], extra: "" });

/** Just the profile fields, for saving a tailored resume back to the member's profile. */
export const toProfile = (d: AtsDoc): ProfileData => ProfileSaveSchema.parse(d);
