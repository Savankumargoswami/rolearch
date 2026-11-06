"use server";

import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

const VERDICTS = ["", "strong", "potential", "stretch", "poor"];
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
