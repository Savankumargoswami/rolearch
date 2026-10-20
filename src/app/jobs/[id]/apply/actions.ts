"use server";

import { revalidatePath } from "next/cache";
import { getJob, getJobText } from "@/data/db";
import { t } from "@/i18n";
import { scoreAts } from "@/lib/ats";
import type { Answer, Question } from "@/lib/hiring";
import { jobRequirements } from "@/lib/job-requirements";
import { loadViewer } from "@/lib/profile";
import { matchProfile } from "@/lib/role-match";
import { createClient } from "@/lib/supabase/server";

export type ApplyResult = { ok: true } | { ok: false; message: string };

/**
 * Applies with the member's Rolearch profile: snapshots the profile and résumé as sent, scores the match
 * the same way the job page does, and files the application in the company's pipeline and the member's tracker.
 */
export async function applyToJob(jobId: string, answers: Answer[], note: string): Promise<ApplyResult> {
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

  const questions = (Array.isArray(row.questions) ? row.questions : []) as Question[];
  const given = new Map(answers.map((a) => [a.q, String(a.a ?? "").trim().slice(0, 2000)]));
  const filled: Answer[] = [];
  for (const q of questions) {
    const a = given.get(q.q) ?? "";
    if (q.required && !a) return { ok: false, message: t("apply.errAnswer", { q: q.q }) };
    if (q.kind === "yesno" && a && a !== "yes" && a !== "no") return { ok: false, message: t("apply.errAnswer", { q: q.q }) };
    filled.push({ q: q.q, a });
  }

  const job = await getJob(jobId);
  const description = await getJobText(jobId);
  const req = job ? await jobRequirements(job, description) : null;
  const target = { title: row.title as string, skills: (row.skills as string[]) ?? [], years: (row.years as number) ?? 0, description };
  const match = matchProfile(target, p, req);
  const ats = scoreAts(target, p, { email: viewer.email, phone: "" });

  const { error } = await db.rpc("apply_to_job", {
    p_secret: process.env.POST_REVIEW_SECRET,
    p_job: jobId,
    p_answers: filled,
    p_note: note.trim().slice(0, 2000),
    p_snapshot: {
      name: p.full_name,
      email: viewer.email,
      headline: p.headline,
      location: p.location,
      avatar: viewer.avatarUrl,
      links: p.links,
      resume: p.resume,
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
