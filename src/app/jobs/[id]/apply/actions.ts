"use server";

import { revalidatePath } from "next/cache";
import { getJob, getJobText } from "@/data/db";
import { t } from "@/i18n";
import { scoreAts } from "@/lib/ats";
import { readForm, STD_FIELDS, type ApplicationInput } from "@/lib/application-form";
import type { Answer } from "@/lib/hiring";
import { jobRequirements } from "@/lib/job-requirements";
import { loadViewer } from "@/lib/profile";
import { matchProfile } from "@/lib/role-match";
import { createClient } from "@/lib/supabase/server";

export type ApplyResult = { ok: true } | { ok: false; message: string };

const clip = (s: unknown, n: number) => String(s ?? "").trim().slice(0, n);
const URL_OK = /^(https?:\/\/)?[^\s/$.?#].[^\s]*$/i;

/**
 * Applies with the member's Rolearch profile and the job's application form (contact details, cover letter,
 * standard and custom questions): snapshots what was sent, scores the match the same way the job page does, and
 * files the application in the company's pipeline and the member's tracker.
 */
export async function applyToJob(jobId: string, input: ApplicationInput): Promise<ApplyResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (viewer.accountType === "company") return { ok: false, message: t("apply.errCompany") };
  const p = viewer.profile;
  if (!p.full_name.trim() || p.resume.experience.length + p.resume.skills.length + p.resume.education.length === 0) {
    return { ok: false, message: t("apply.errProfile") };
  }

  const db = await createClient();
  const { data: row } = await db.from("jobs").select("id,title,status,posted_by,questions,skills,years").eq("id", jobId).maybeSingle();
  if (!row || row.status !== "open" || !row.posted_by) return { ok: false, message: t("apply.errClosed") };

  const form = readForm(row.questions);
  const contact = {
    firstName: clip(input.firstName, 80),
    lastName: clip(input.lastName, 80),
    phone: clip(input.phone, 40),
    location: clip(input.location, 120),
    linkedin: clip(input.linkedin, 300),
    website: clip(input.website, 300),
  };
  if (!contact.firstName || !contact.lastName) return { ok: false, message: t("apply.errAnswer", { q: "First and last name" }) };
  if (!input.attest) return { ok: false, message: t("apply.errAnswer", { q: "Confirm the information is accurate" }) };
  const coverLetter = clip(input.coverLetter, 6000);
  const filled: Answer[] = [];
  for (const f of STD_FIELDS) {
    const mode = form.modes[f.id];
    if (mode === "off") continue;
    const a =
      f.id === "phone" ? contact.phone
      : f.id === "location" ? contact.location
      : f.id === "linkedin" ? contact.linkedin
      : f.id === "website" ? contact.website
      : f.id === "coverLetter" ? coverLetter
      : clip(input.std?.[f.id], 300);
    if (mode === "required" && !a) return { ok: false, message: t("apply.errAnswer", { q: f.label }) };
    if (f.input === "yesno" && a && a !== "yes" && a !== "no") return { ok: false, message: t("apply.errAnswer", { q: f.label }) };
    if (f.input === "url" && a && !URL_OK.test(a)) return { ok: false, message: t("apply.errAnswer", { q: f.label }) };
    // Contact details and the cover letter travel in the snapshot; the rest are answers.
    if (f.step === "questions") filled.push({ q: f.label, a });
  }
  for (const q of form.custom) {
    const a = clip(input.custom?.[q.q], q.kind === "longtext" ? 4000 : 2000);
    if (q.required && !a) return { ok: false, message: t("apply.errAnswer", { q: q.q }) };
    if (q.kind === "yesno" && a && a !== "yes" && a !== "no") return { ok: false, message: t("apply.errAnswer", { q: q.q }) };
    if (q.kind === "choice" && a && !(q.options ?? []).includes(a)) return { ok: false, message: t("apply.errAnswer", { q: q.q }) };
    filled.push({ q: q.q, a });
  }

  const job = await getJob(jobId);
  const description = await getJobText(jobId);
  const req = job ? await jobRequirements(job, description) : null;
  const target = { title: row.title as string, skills: (row.skills as string[]) ?? [], years: (row.years as number) ?? 0, description };
  const match = matchProfile(target, p, req);
  const ats = scoreAts(target, p, { email: viewer.email, phone: contact.phone });

  const { error } = await db.rpc("apply_to_job", {
    p_secret: process.env.POST_REVIEW_SECRET,
    p_job: jobId,
    p_answers: filled,
    p_note: coverLetter.slice(0, 2000),
    p_snapshot: {
      name: `${contact.firstName} ${contact.lastName}`.trim() || p.full_name,
      email: viewer.email,
      headline: p.headline,
      location: contact.location || p.location,
      avatar: viewer.avatarUrl,
      links: [
        ...(contact.linkedin ? [{ label: "LinkedIn", url: contact.linkedin }] : []),
        ...(contact.website ? [{ label: "Website", url: contact.website }] : []),
        ...p.links.filter((l) => l.url && l.url !== contact.linkedin && l.url !== contact.website),
      ],
      resume: p.resume,
      phone: contact.phone,
      coverLetter,
      attestedAt: new Date().toISOString(),
    },
    p_match_score: match.score,
    p_match: { verdict: match.verdict, missing: match.missing, reqs: match.reqs },
    p_ats_score: ats.score,
  });
  if (error) {
    if (error.code === "23505") return { ok: false, message: t("apply.errAlready") };
    console.error("[apply] failed:", error.message);
    return { ok: false, message: t("apply.errSave") };
  }
  revalidatePath("/tracker");
  revalidatePath(`/jobs/${jobId}`);
  return { ok: true };
}

export async function withdrawApplication(appId: string): Promise<ApplyResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const { error } = await db.rpc("withdraw_application", { p_app: appId });
  if (error) return { ok: false, message: t("apply.errSave") };
  revalidatePath("/tracker");
  return { ok: true };
}
