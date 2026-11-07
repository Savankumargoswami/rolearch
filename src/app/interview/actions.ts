"use server";

import { getJob, getJobText } from "@/data/db";
import { t } from "@/i18n";
import { answerFeedback, interviewQuestions, type AnswerFeedback, type PrepQuestion } from "@/lib/interview-prep";
import { loadViewer } from "@/lib/profile";
import { allow } from "@/lib/rate-limit";

type Fail = { ok: false; message: string };

async function context(jobId: string) {
  const viewer = await loadViewer();
  if (!viewer) return { error: t("profile.errSignedOut") };
  const p = viewer.profile;
  if (p.resume.experience.length + p.resume.skills.length === 0) return { error: t("interview.errProfile") };
  const job = await getJob(jobId);
  if (!job) return { error: t("interview.errJob") };
  const description = (await getJobText(job.id)) || job.summary;
  if (description.trim().length < 120) return { error: t("interview.errJob") };
  return { p, id: viewer.id, job: { title: job.title, company: job.company, description } };
}

/** Interview questions for one job, from its description and the member's own profile. */
export async function prepQuestions(jobId: string): Promise<{ ok: true; questions: PrepQuestion[] } | Fail> {
  try {
    const c = await context(String(jobId).slice(0, 100));
    if ("error" in c) return { ok: false, message: c.error ?? t("interview.errFailed") };
    if (!(await allow(c.id, "prep"))) return { ok: false, message: t("ats.errLimit") };
    const out = await interviewQuestions(c.job, c.p);
    if ("error" in out) return { ok: false, message: out.error === "unavailable" ? t("interview.errOff") : t("interview.errFailed") };
    return { ok: true, questions: out };
  } catch (e) {
    console.error("[interview] prepQuestions:", e instanceof Error ? e.message : e);
    return { ok: false, message: t("interview.errFailed") };
  }
}

/** Feedback on one practice answer: what worked, what's missing, and the knowledge gaps it revealed. */
export async function prepFeedback(jobId: string, question: string, answer: string): Promise<{ ok: true; feedback: AnswerFeedback } | Fail> {
  try {
    const text = String(answer ?? "").trim();
    if (text.split(/\s+/).length < 15) return { ok: false, message: t("interview.errShort") };
    const c = await context(String(jobId).slice(0, 100));
    if ("error" in c) return { ok: false, message: c.error ?? t("interview.errFailed") };
    if (!(await allow(c.id, "feedback"))) return { ok: false, message: t("ats.errLimit") };
    const out = await answerFeedback(c.job, c.p, String(question).slice(0, 600), text.slice(0, 6000));
    if ("error" in out) return { ok: false, message: out.error === "unavailable" ? t("interview.errOff") : t("interview.errFailed") };
    return { ok: true, feedback: out };
  } catch (e) {
    console.error("[interview] prepFeedback:", e instanceof Error ? e.message : e);
    return { ok: false, message: t("interview.errFailed") };
  }
}
