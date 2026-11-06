"use server";

import { createHash } from "node:crypto";
import { getJob, getJobText } from "@/data/db";
import { liveDescription } from "@/lib/live-description";
import { t } from "@/i18n";
import { resumeText, scoreAts, type AtsFile, type AtsJob, type AtsReport } from "@/lib/ats";
import { AtsDocSchema, fit, fromProfile, MAX_WORDS, type AtsDoc } from "@/lib/ats-doc";
import { jobAtsKeywords } from "@/lib/ats-keywords-cached";
import { writeCoverLetter } from "@/lib/cover-letter";
import { docxFacts } from "@/lib/docx-format";
import { fitReport, type FitReport } from "@/lib/fit";
import { jobRequirements, readRequirements, type JobRequirements } from "@/lib/job-requirements";
import { loadAccount } from "@/lib/profile";
import { coverLetterDocx, resumeDocx } from "@/lib/resume-docx";
import { optimizeResume, placeKeywords, rewriteLine, type Change, type TailorMode } from "@/lib/resume-optimizer";
import { coverLetterPdf, resumePdf } from "@/lib/resume-pdf";
import { readResume, type Contact } from "@/lib/resume-reader";
import { jobScreening, screen, type JobScreening, type Screening } from "@/lib/screening";
import { signShare } from "@/lib/share-card";
import { SKILLS } from "@/lib/skill-tests";
import { systemFromUrl } from "@/lib/ats-system";
import { keepOriginal, unsupported } from "@/lib/tailor-evidence";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type Checked =
  | { ok: true; report: AtsReport; resume: AtsDoc; contact: Contact; file: AtsFile | null; screening: Screening | null; fit: FitReport }
  | { ok: false; message: string };
export type OptimizedResult =
  | {
      ok: true;
      before: number;
      report: AtsReport;
      resume: AtsDoc;
      changes: Change[];
      skipped: { keyword: string; reason: string }[];
      /** The score tailoring aims for, and the missing keywords that stand between the resume and it. */
      goal: number;
      blocking: string[];
    }
  | { ok: false; message: string };
type FileResult = { ok: true; filename: string; base64: string; type: string } | { ok: false; message: string };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/** A Rolearch job by ID, or a job someone pasted into the free ATS check (with its link, if they have it). */
export type AtsTarget = string | { title: string; description: string; company?: string; url?: string };

const MIN_PASTED = 200;
const MAX_PASTED = 50000; // characters: generous, just not unbounded
const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
// Shorter than this, a saved posting is only a summary: too little to scan honestly.
const MIN_SAVED = 600;

/** where: the stored job's city and workplace, a fallback when the posting doesn't say. */
type Found =
  | { job: AtsJob & { company: string }; description: string; screening: JobScreening | null; where: { city?: string; workplace?: string }; req: JobRequirements | null; tags: string[] }
  | { error: string };

async function jobFor(target: AtsTarget): Promise<Found> {
  if (typeof target === "string") {
    const job = await getJob(target);
    if (!job) return { error: t("ats.errJob") };
    let description = await getJobText(target);
    // Not stored yet: read it from the employer's own posting.
    if (description.trim().length < MIN_SAVED && job.jobUrl) description = (await liveDescription(job.id, job.jobUrl)) || description;
    if (description.trim().length < MIN_SAVED) return { error: t("ats.errShort") };
    // The job's own requirements (read once per job and stored) back up the scanner keywords.
    const [req, keywords, screening] = await Promise.all([jobRequirements(job, description), jobAtsKeywords(job.id, job.title, description), jobScreening(job.id, job.title, description)]);
    const skills = [...new Set([...job.skills, ...(req?.required ?? []), ...(req?.certifications ?? [])])];
    const system = job.source && !/careers page|employer feed|adzuna|usajobs/i.test(job.source) ? job.source : "";
    return {
      job: { title: job.title, company: job.company, description, keywords, skills, preferred: req?.preferred ?? [], years: req?.years || job.years, system },
      description,
      screening,
      where: { city: job.city, workplace: job.workplace },
      req,
      tags: job.skills,
    };
  }
  const title = String(target?.title ?? "").trim().slice(0, 200);
  const description = String(target?.description ?? "").trim().slice(0, MAX_PASTED);
  if (!title || description.length < MIN_PASTED) return { error: t("ats.errPasted") };
  // Pasted jobs: requirements are read now and not kept; keywords are kept by a hash of the text, so scanning
  // the same posting twice gives the same report.
  const key = `pasted-${createHash("sha256").update(`${title}\n${description}`).digest("hex").slice(0, 32)}`;
  const [req, keywords, screening] = await Promise.all([readRequirements(title, description), jobAtsKeywords(key, title, description), jobScreening(key, title, description)]);
  const skills = req ? [...req.required, ...req.certifications] : [];
  const company = String(target.company ?? "").trim().slice(0, 120);
  return { job: { title, company, description, keywords, skills, preferred: req?.preferred ?? [], years: req?.years ?? 0, system: systemFromUrl(String(target.url ?? "")) }, description, screening, where: {}, req, tags: [] };
}

/** The resume as sent back by the browser, with anything over the limits shortened (null if it isn't a resume). */
function fitted(resume: unknown): AtsDoc | null {
  try {
    return fit(AtsDocSchema, resume);
  } catch {
    return null;
  }
}

const sanitizeContact = (c: Contact): Contact => ({ email: String(c.email ?? "").slice(0, 200), phone: String(c.phone ?? "").slice(0, 40) });

/** The layout facts of a file as the browser hands them back (it only ever sends what we sent it). */
function sanitizeFile(f: AtsFile | null | undefined): AtsFile | undefined {
  if (!f || (f.kind !== "pdf" && f.kind !== "docx")) return undefined;
  return { name: String(f.name ?? "").slice(0, 200), kind: f.kind, facts: f.facts && typeof f.facts === "object" ? f.facts : null };
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "").slice(0, 40);
const resumeName = (d: AtsDoc, company: string) => `${slug(d.full_name || "Resume")}${company ? `_${slug(company)}` : ""}_Resume`;

function screeningFor(found: Extract<Found, { job: unknown }>, resume: AtsDoc): Screening | null {
  return found.screening ? screen(found.screening, resume, resumeText(resume), { years: found.job.years, ...found.where }) : null;
}

/** The signed-in member's Rolearch skill badges (verified skills count as the strongest evidence). */
async function myBadges(): Promise<{ skill: string; level: string }[]> {
  const db = await createClient();
  const user = await signedIn();
  if (!user) return [];
  const { data } = await db.from("skill_badges").select("skill,level").eq("user_id", user.id);
  return (data ?? []) as { skill: string; level: string }[];
}

/** The job-fit report: skills with evidence, experience, industry, education, eligibility and presentation. */
async function fitFor(found: Extract<Found, { job: unknown }>, resume: AtsDoc, screening: Screening | null, ats: AtsReport): Promise<FitReport> {
  const req = found.req;
  const required = req && req.required.length ? req.required : found.tags.length ? found.tags : found.job.skills;
  return fitReport(
    {
      title: found.job.title,
      description: found.description,
      required: required.slice(0, 14),
      preferred: (req?.preferred ?? found.job.preferred ?? []).slice(0, 8),
      certifications: (req?.certifications ?? []).slice(0, 6),
      years: found.job.years,
      education: req?.education ?? "none",
    },
    resume,
    { badges: await myBadges(), screening, ats, tests: SKILLS },
  );
}

/** Scores the signed-in member's saved profile against a job. */
async function checkProfileInner(target: AtsTarget, phone: string): Promise<Checked> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const found = await jobFor(target);
  if ("error" in found) return { ok: false, message: found.error };
  const account = await loadAccount();
  const resume = fromProfile(account.profile);
  if (resume.resume.experience.length + resume.resume.skills.length === 0) return { ok: false, message: t("ats.errEmptyProfile") };
  const contact = sanitizeContact({ email: account.email, phone });
  const report = scoreAts(found.job, resume, contact);
  const screening = screeningFor(found, resume);
  return { ok: true, resume, contact, file: null, report, screening, fit: await fitFor(found, resume, screening, report) };
}

/** Reads an uploaded resume (not stored) and scores it against a job, layout included for Word files. */
async function checkUploadInner(target: AtsTarget, form: FormData): Promise<Checked> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const upload = form.get("resume");
  if (!(upload instanceof File) || upload.size === 0) return { ok: false, message: t("profile.errNoFile") };
  if (upload.size > MAX_BYTES) return { ok: false, message: t("profile.errTooBig") };
  const kind = TYPES[upload.type as keyof typeof TYPES];
  if (!kind) return { ok: false, message: t("profile.errType") };
  const bytes = Buffer.from(await upload.arrayBuffer());
  const [found, read, facts] = await Promise.all([jobFor(target), readResume({ bytes, kind }), kind === "docx" ? docxFacts(bytes) : Promise.resolve(null)]);
  if ("error" in found) return { ok: false, message: found.error };
  if ("error" in read) {
    const key = { unavailable: "profile.errReaderOff", refused: "profile.errUnreadable", unreadable: "profile.errUnreadable", too_long: "profile.errTooLong" } as const;
    return { ok: false, message: t(key[read.error]) };
  }
  if (words(resumeText(read.draft)) > MAX_WORDS) return { ok: false, message: t("ats.errResumeTooLong", { n: MAX_WORDS.toLocaleString("en") }) };
  const contact = sanitizeContact(read.contact);
  const file: AtsFile = { name: upload.name.slice(0, 200), kind, facts };
  const report = scoreAts(found.job, read.draft, contact, file);
  const screening = screeningFor(found, read.draft);
  return { ok: true, resume: read.draft, contact, file, report, screening, fit: await fitFor(found, read.draft, screening, report) };
}

/** Tailoring aims for this score (Jobscan's own guidance is 75-80%), without adding anything untrue. */
const GOAL = 80;

/** Tailors a resume to the job, then re-scores it, layout included, as the Word file we'd hand back. */
async function optimizeForJobInner(
  target: AtsTarget,
  resume: AtsDoc,
  contact: Contact,
  confirmed: string[],
  original: AtsFile | null,
  mode: TailorMode = "deep",
): Promise<OptimizedResult> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const started = Date.now();
  const parsed = fitted(resume);
  if (!parsed) return { ok: false, message: t("profile.errInvalid") };
  const found = await jobFor(target);
  if ("error" in found) return { ok: false, message: found.error };
  const { job, description } = found;
  const safeContact = sanitizeContact(contact);
  const before = scoreAts(job, parsed, safeContact, sanitizeFile(original));
  const missing = before.keywords.filter((k) => k.inResume === 0).map((k) => k.name);
  const confirmedOk = confirmed.filter((s) => missing.includes(s)).slice(0, 30);

  const out = await optimizeResume({
    resume: parsed,
    job: { title: job.title, company: job.company, description },
    missing,
    confirmed: confirmedOk,
    mode: mode === "onepage" ? "onepage" : "deep",
  });
  if ("error" in out) return { ok: false, message: out.error === "unavailable" ? t("ats.errOff") : t("ats.errOptimize") };
  const ours = async (d: AtsDoc): Promise<AtsFile> => ({ name: `${resumeName(d, job.company)}.docx`, kind: "docx", facts: await docxFacts(await resumeDocx(d, safeContact)) });
  let report = scoreAts(job, out.resume, safeContact, await ours(out.resume));
  let improved = out.resume;
  let changes = out.changes;
  let skipped = out.skipped;
  // Short of the goal: a quick pass on just the keywords still missing, if there's time left in the request.
  const still = () => report.keywords.filter((k) => k.inResume === 0).map((k) => k.name);
  if (report.score < GOAL && still().length && Date.now() - started < 60_000) {
    const more = await placeKeywords({ resume: improved, original: parsed, job: { title: job.title, description }, remaining: still(), confirmed: confirmedOk });
    if (more) {
      const next = scoreAts(job, more.resume, safeContact, await ours(more.resume));
      if (next.score > report.score) {
        report = next;
        improved = more.resume;
        changes = [...changes, ...more.changes];
        skipped = more.skipped.length ? more.skipped : skipped;
      }
    }
  }
  // Evidence check: an edit that brings in a job keyword the original resume never shows (and the person hasn't
  // confirmed) is undone, and the keyword becomes a question for the person instead.
  const originalText = resumeText(parsed);
  const keywordNames = before.keywords.map((k) => k.name);
  const asked = new Set<string>();
  const kept: Change[] = [];
  for (const c of changes) {
    const bad = unsupported(c, originalText, keywordNames, confirmedOk);
    if (bad.length) {
      improved = keepOriginal(improved, c);
      bad.forEach((k) => asked.add(k));
    } else kept.push(c);
  }
  if (kept.length < changes.length) {
    changes = kept;
    report = scoreAts(job, improved, safeContact, await ours(improved));
  }
  // Never hand back something that scores worse than what came in.
  if (report.score < before.score) {
    improved = parsed;
    report = before;
  }
  // What's left between the resume and the goal: missing keywords the person hasn't said they have.
  const blocking = [...new Set([...asked, ...(report.score < GOAL ? still() : [])])].filter((k) => !confirmed.includes(k)).slice(0, 15);
  return { ok: true, before: before.score, report, resume: improved, changes: changes.slice(0, 25), skipped: skipped.slice(0, 20), goal: GOAL, blocking };
}

/** An ATS-friendly resume as a Word (.docx) or PDF file, as base64 for the browser to save. */
async function downloadResumeInner(resume: AtsDoc, contact: Contact, company: string, format: "docx" | "pdf"): Promise<FileResult> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const parsed = fitted(resume);
  if (!parsed) return { ok: false, message: t("profile.errInvalid") };
  const safe = sanitizeContact(contact);
  const buf = format === "pdf" ? await resumePdf(parsed, safe) : await resumeDocx(parsed, safe);
  return { ok: true, filename: `${resumeName(parsed, String(company))}.${format}`, base64: buf.toString("base64"), type: format === "pdf" ? "application/pdf" : DOCX };
}

/** A cover letter for this job written from the resume's facts, as a Word or PDF file. */
async function coverLetterInner(target: AtsTarget, resume: AtsDoc, contact: Contact, format: "docx" | "pdf"): Promise<FileResult & { text?: string }> {
  if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
  const parsed = fitted(resume);
  if (!parsed) return { ok: false, message: t("profile.errInvalid") };
  const found = await jobFor(target);
  if ("error" in found) return { ok: false, message: found.error };
  const letter = await writeCoverLetter({ resume: parsed, job: { title: found.job.title, company: found.job.company, description: found.description } });
  if ("error" in letter) return { ok: false, message: letter.error === "unavailable" ? t("ats.errOff") : t("ats.errLetter") };
  const safe = sanitizeContact(contact);
  const buf = format === "pdf" ? await coverLetterPdf(parsed, safe, letter.paragraphs) : await coverLetterDocx(parsed, safe, letter.paragraphs);
  const company = found.job.company;
  return {
    ok: true,
    filename: `${slug(parsed.full_name || "Cover")}${company ? `_${slug(company)}` : ""}_Cover_Letter.${format}`,
    base64: buf.toString("base64"),
    type: format === "pdf" ? "application/pdf" : DOCX,
    text: letter.paragraphs.join("\n\n"),
  };
}

/** A link to a public score card, for members to share after a check. */
export async function shareLink(before: number | null, after: number, title: string): Promise<string | null> {
  if (!(await signedIn())) return null;
  const n = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return `/s/${signShare({ before: before === null ? null : n(before), after: n(after), title: String(title).trim() })}`;
}

/** Any unexpected failure (a timeout upstream, an API error) comes back as a message instead of breaking the page. */
function guarded<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  return async (...args: A): Promise<R | { ok: false; message: string }> => {
    try {
      return await fn(...args);
    } catch (e) {
      console.error(`[ats] ${name} failed:`, e instanceof Error ? e.stack ?? e.message : e);
      return { ok: false, message: t("ats.errUnexpected") };
    }
  };
}

export async function checkProfile(target: AtsTarget, phone: string): Promise<Checked> {
  return (await guarded("checkProfile", checkProfileInner)(target, phone)) as Checked;
}
export async function checkUpload(target: AtsTarget, form: FormData): Promise<Checked> {
  return (await guarded("checkUpload", checkUploadInner)(target, form)) as Checked;
}
export async function optimizeForJob(target: AtsTarget, resume: AtsDoc, contact: Contact, confirmed: string[], original: AtsFile | null, mode: TailorMode = "deep"): Promise<OptimizedResult> {
  return (await guarded("optimizeForJob", optimizeForJobInner)(target, resume, contact, confirmed, original, mode)) as OptimizedResult;
}
export async function downloadResume(resume: AtsDoc, contact: Contact, company: string, format: "docx" | "pdf"): Promise<FileResult> {
  return (await guarded("downloadResume", downloadResumeInner)(resume, contact, company, format)) as FileResult;
}
export async function coverLetter(target: AtsTarget, resume: AtsDoc, contact: Contact, format: "docx" | "pdf"): Promise<FileResult & { text?: string }> {
  return (await guarded("coverLetter", coverLetterInner)(target, resume, contact, format)) as FileResult & { text?: string };
}

/** "Rewrite": a different wording for one suggested edit, under the same evidence rules. */
export async function rewriteEdit(target: AtsTarget, change: Change, confirmed: string[]): Promise<{ ok: true; after: string } | { ok: false; message: string }> {
  try {
    if (!(await signedIn())) return { ok: false, message: t("profile.errSignedOut") };
    const found = await jobFor(target);
    if ("error" in found) return { ok: false, message: found.error };
    const line = await rewriteLine({
      original: String(change.before ?? "").slice(0, 600),
      current: String(change.after ?? "").slice(0, 600),
      requirement: String(change.requirement ?? "").slice(0, 200),
      job: { title: found.job.title, description: found.description },
    });
    if (!line) return { ok: false, message: t("ats.errRewrite") };
    const keywords = (found.job.keywords?.hard ?? found.job.skills).slice(0, 40);
    const bad = unsupported({ ...change, after: line }, String(change.before ?? ""), keywords, confirmed.slice(0, 30).map(String));
    if (bad.length) return { ok: false, message: t("ats.errRewriteEvidence", { what: bad.slice(0, 3).join(", ") }) };
    return { ok: true, after: line };
  } catch (e) {
    console.error("[ats] rewriteEdit failed:", e instanceof Error ? e.stack ?? e.message : e);
    return { ok: false, message: t("ats.errUnexpected") };
  }
}

/** Resume version manager: keeps a tailored resume as its own version (the profile stays the original). */
export async function saveVersion(
  target: AtsTarget,
  meta: { title: string; company: string },
  resume: AtsDoc,
  counts: { accepted: number; kept: number },
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  try {
    const user = await signedIn();
    if (!user) return { ok: false, message: t("profile.errSignedOut") };
    const parsed = fitted(resume);
    if (!parsed) return { ok: false, message: t("profile.errInvalid") };
    const db = await createClient();
    const title = String(meta.title ?? "").slice(0, 200);
    const company = String(meta.company ?? "").slice(0, 120);
    const jobId = typeof target === "string" ? target.slice(0, 100) : "";
    const { data, error } = await db
      .from("resume_versions")
      .insert({
        user_id: user.id,
        job_id: jobId,
        title,
        company,
        label: [title, company].filter(Boolean).join(" · ").slice(0, 120),
        doc: parsed,
        accepted: Math.max(0, Math.min(500, Math.round(Number(counts.accepted) || 0))),
        kept: Math.max(0, Math.min(500, Math.round(Number(counts.kept) || 0))),
      })
      .select("id")
      .single();
    if (error || !data) return { ok: false, message: error?.code === "42P01" ? t("tracker.errNotReady") : t("ats.errVersion") };
    // Link the version to the tracked job, so outcomes can be compared by version.
    if (jobId) await db.from("tracked_jobs").update({ resume_version: data.id }).eq("user_id", user.id).eq("job_id", jobId);
    return { ok: true, id: data.id };
  } catch (e) {
    console.error("[ats] saveVersion failed:", e instanceof Error ? e.stack ?? e.message : e);
    return { ok: false, message: t("ats.errUnexpected") };
  }
}
