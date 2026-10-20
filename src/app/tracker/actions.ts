"use server";

import { revalidatePath } from "next/cache";
import { getJob } from "@/data/db";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { TRACKER_STATUSES, type TrackerStatus } from "@/lib/tracker";

export type TrackResult = { ok: true } | { ok: false; message: string };

/** Adds a job to the member's tracker (or moves it to `status` if it's already there). */
export async function trackJob(jobId: string, status: TrackerStatus = "saved"): Promise<TrackResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (!TRACKER_STATUSES.includes(status)) return { ok: false, message: t("tracker.errSave") };
  const job = await getJob(jobId);
  if (!job) return { ok: false, message: t("tracker.errSave") };
  const db = await createClient();
  const now = new Date().toISOString();
  const { error } = await db.from("tracked_jobs").upsert(
    {
      user_id: viewer.id,
      job_id: jobId,
      status,
      title: job.title,
      company: job.company,
      url: job.source === "Rolearch" ? `/jobs/${jobId}` : job.jobUrl,
      updated_at: now,
      ...(status === "applied" ? { applied_at: now } : {}),
    },
    { onConflict: "user_id,job_id" },
  );
  if (error) return { ok: false, message: t("tracker.errSave") };
  revalidatePath("/tracker");
  return { ok: true };
}

export async function untrackJob(jobId: string): Promise<TrackResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const { error } = await db.from("tracked_jobs").delete().eq("user_id", viewer.id).eq("job_id", jobId);
  if (error) return { ok: false, message: t("tracker.errSave") };
  revalidatePath("/tracker");
  return { ok: true };
}

export async function updateTracked(jobId: string, patch: { status?: TrackerStatus; notes?: string }): Promise<TrackResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (patch.status && !TRACKER_STATUSES.includes(patch.status)) return { ok: false, message: t("tracker.errSave") };
  const db = await createClient();
  const now = new Date().toISOString();
  const { error } = await db
    .from("tracked_jobs")
    .update({
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.status === "applied" ? { applied_at: now } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 4000) } : {}),
      updated_at: now,
    })
    .eq("user_id", viewer.id)
    .eq("job_id", jobId);
  if (error) return { ok: false, message: t("tracker.errSave") };
  revalidatePath("/tracker");
  return { ok: true };
}
