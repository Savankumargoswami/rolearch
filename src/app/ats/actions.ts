"use server";

import { getJob, getJobText } from "@/data/db";
import { t } from "@/i18n";
import { scoreAts, type AtsReport } from "@/lib/ats";
import { ProfileSaveSchema, type ProfileData } from "@/lib/profile-schema";
import { loadAccount } from "@/lib/profile";
import { resumeDocx } from "@/lib/resume-docx";
import { optimizeResume, type Change } from "@/lib/resume-optimizer";
import { readResume, type Contact } from "@/lib/resume-reader";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

export type Checked = { ok: true; report: AtsReport; resume: ProfileData; contact: Contact } | { ok: false; message: string };
export type OptimizedResult =
  | { ok: true; before: number; report: AtsReport; resume: ProfileData; changes: Change[]; skipped: { keyword: string; reason: string }[] }
  | { ok: false; message: string };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

async function jobFor(jobId: string) {
  const job = await getJob(jobId);
  if (!job) return null;
  return { job, description: await getJobText(jobId) };
}

const sanitizeContact = (c: Contact): Contact => ({ email: String(c.email ?? "").slice(0, 200), phone: String(c.phone ?? "").slice(0, 40) });

/** Scores the signed-in member's saved profile against a job. Free and instant: no AI involved. */
export async function checkProfile(jobId: string, phone: string): Promise<Checked> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const found = await jobFor(jobId);
  if (!found) return { ok: false, message: t("ats.errJob") };
  const account = await loadAccount();
  const resume = account.profile;
  if (resume.resume.experience.length + resume.resume.skills.length === 0) return { ok: false, message: t("ats.errEmptyProfile") };
  const contact = sanitizeContact({ email: account.email, phone });
  const { job, description } = found;
  return { ok: true, resume, contact, report: scoreAts({ title: job.title, description, skills: job.skills, years: job.years }, resume, contact) };
}

/** Reads an uploaded resume (not stored) and scores it against a job. */
export async function checkUpload(jobId: string, form: FormData): Promise<Checked> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const file = form.get("resume");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: t("profile.errNoFile") };
  if (file.size > MAX_BYTES) return { ok: false, message: t("profile.errTooBig") };
  const kind = TYPES[file.type as keyof typeof TYPES];
  if (!kind) return { ok: false, message: t("profile.errType") };
  const found = await jobFor(jobId);
  if (!found) return { ok: false, message: t("ats.errJob") };

  const read = await readResume({ bytes: Buffer.from(await file.arrayBuffer()), kind });
  if ("error" in read) {
    const key = { unavailable: "profile.errReaderOff", refused: "profile.errUnreadable", unreadable: "profile.errUnreadable", too_long: "profile.errTooLong" } as const;
    return { ok: false, message: t(key[read.error]) };
  }
  const contact = sanitizeContact(read.contact);
  const { job, description } = found;
  return { ok: true, resume: read.draft, contact, report: scoreAts({ title: job.title, description, skills: job.skills, years: job.years }, read.draft, contact) };
}

/** Tailors a resume to the job with Claude, then re-scores it with the same scorer. */
export async function optimizeForJob(jobId: string, resume: ProfileData, contact: Contact, confirmed: string[]): Promise<OptimizedResult> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const parsed = ProfileSaveSchema.safeParse(resume);
  if (!parsed.success) return { ok: false, message: t("profile.errInvalid") };
  const found = await jobFor(jobId);
  if (!found) return { ok: false, message: t("ats.errJob") };
  const { job, description } = found;
  const safeContact = sanitizeContact(contact);
  const atsJob = { title: job.title, description, skills: job.skills, years: job.years };
  const before = scoreAts(atsJob, parsed.data, safeContact);
  const missing = before.keywords.filter((k) => k.inResume === 0).map((k) => k.name);
  const confirmedOk = confirmed.filter((s) => missing.includes(s)).slice(0, 30);

  const out = await optimizeResume({ resume: parsed.data, job: { title: job.title, company: job.company, description }, missing, confirmed: confirmedOk });
  if ("error" in out) return { ok: false, message: out.error === "unavailable" ? t("ats.errOff") : t("ats.errOptimize") };
  let report = scoreAts(atsJob, out.resume, safeContact);
  let improved = out.resume;
  // Never hand back something that scores worse than what came in.
  if (report.score < before.score) {
    improved = parsed.data;
    report = before;
  }
  return { ok: true, before: before.score, report, resume: improved, changes: out.changes.slice(0, 25), skipped: out.skipped.slice(0, 20) };
}

/** An ATS-friendly .docx of a resume, as base64 for the browser to save. */
export async function downloadDocx(resume: ProfileData, contact: Contact, company: string): Promise<{ ok: true; filename: string; base64: string } | { ok: false; message: string }> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const parsed = ProfileSaveSchema.safeParse(resume);
  if (!parsed.success) return { ok: false, message: t("profile.errInvalid") };
  const buf = await resumeDocx(parsed.data, sanitizeContact(contact));
  const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 40);
  return { ok: true, filename: `${slug(parsed.data.full_name || "Resume")}-Resume${company ? `-${slug(company)}` : ""}.docx`, base64: buf.toString("base64") };
}
