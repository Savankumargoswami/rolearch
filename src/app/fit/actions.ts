"use server";

import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/events";

const VERDICTS = ["", "strong", "potential", "stretch", "poor", "insufficient"];
const PLACES = ["", "discover", "jobs", "job", "ats"];

/** A member's rating of whether a recommended job / fit verdict was relevant (validation metric). */
export async function rateFit(jobId: string, relevant: boolean, verdict: string, score: number, place: string): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const { error } = await db.from("fit_feedback").upsert(
    {
      user_id: viewer.id,
      job_id: String(jobId).slice(0, 100),
      relevant: Boolean(relevant),
      verdict: VERDICTS.includes(verdict) ? verdict : "",
      score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null,
      place: PLACES.includes(place) ? place : "",
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,job_id" },
  );
  if (error) return { ok: false, message: error.code === "42P01" ? t("tracker.errNotReady") : t("fit.voteError") };
  return { ok: true };
}

const CORRECTIONS = ["lack", "have", "wrong"];

/** The member's correction for one requirement ("I have this", "I don't have this", "this evidence is wrong"), or null to undo it. */
export async function setCorrection(skill: string, kind: string | null): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const key = String(skill ?? "").trim().toLowerCase().slice(0, 80);
  if (!key || (kind !== null && !CORRECTIONS.includes(kind))) return { ok: false, message: t("fit.voteError") };
  const db = await createClient();
  const { error } =
    kind === null
      ? await db.from("fit_corrections").delete().eq("user_id", viewer.id).eq("skill_key", key)
      : await db.from("fit_corrections").upsert({ user_id: viewer.id, skill_key: key, kind, created_at: new Date().toISOString() }, { onConflict: "user_id,skill_key" });
  if (error) return { ok: false, message: error.code === "42P01" ? t("tracker.errNotReady") : t("fit.voteError") };
  await track(viewer.id, "requirement_feedback", { correction: kind ?? "undo" });
  return { ok: true };
}

const REPORT_KINDS = ["wrong_match", "wrong_fact", "privacy", "other"];

/** "Report a problem with this analysis". */
export async function reportAnalysis(jobKey: string, kind: string, note: string, version: string): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (!REPORT_KINDS.includes(kind)) return { ok: false, message: t("fit.voteError") };
  const db = await createClient();
  const { error } = await db.from("analysis_reports").insert({
    user_id: viewer.id,
    job_key: String(jobKey ?? "").slice(0, 120),
    kind,
    note: String(note ?? "").slice(0, 2000),
    version: String(version ?? "").slice(0, 40),
  });
  if (error) return { ok: false, message: error.code === "42P01" ? t("tracker.errNotReady") : t("fit.voteError") };
  return { ok: true };
}
