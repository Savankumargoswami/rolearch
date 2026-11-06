"use server";

import { revalidatePath } from "next/cache";
import { getJob } from "@/data/db";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { LOG_KINDS, REJECTION_REASONS, TRACKER_STATUSES, type LogEntry, type TrackerStatus } from "@/lib/tracker";

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

const isoDate = (v: string | null | undefined) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null);
const isoTime = (v: string | null | undefined) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toISOString() : null);

export type ManagerPatch = {
  deadline?: string | null;
  interviewAt?: string | null;
  followUpOn?: string | null;
  contactName?: string;
  contactEmail?: string;
  rejectionReason?: string;
};

/** AI application manager details: deadline, interview, follow-up date, recruiter contact and rejection reason. */
export async function updateManager(jobId: string, patch: ManagerPatch): Promise<TrackResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const reason = patch.rejectionReason ?? undefined;
  if (reason !== undefined && reason !== "" && !(REJECTION_REASONS as readonly string[]).includes(reason)) return { ok: false, message: t("tracker.errSave") };
  const db = await createClient();
  const { error } = await db
    .from("tracked_jobs")
    .update({
      ...("deadline" in patch ? { deadline: isoDate(patch.deadline) } : {}),
      ...("interviewAt" in patch ? { interview_at: isoTime(patch.interviewAt) } : {}),
      ...("followUpOn" in patch ? { follow_up_on: isoDate(patch.followUpOn) } : {}),
      ...(patch.contactName !== undefined ? { contact_name: patch.contactName.trim().slice(0, 120) } : {}),
      ...(patch.contactEmail !== undefined ? { contact_email: patch.contactEmail.trim().slice(0, 200) } : {}),
      ...(reason !== undefined ? { rejection_reason: reason } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", viewer.id)
    .eq("job_id", jobId);
  if (error) return { ok: false, message: error.code === "42703" ? t("tracker.errNotReady") : t("tracker.errSave") };
  revalidatePath("/tracker");
  return { ok: true };
}

/** Adds a recruiter conversation or event to an application's log. */
export async function addLogEntry(jobId: string, entry: { kind: string; text: string }): Promise<TrackResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const text = String(entry.text ?? "").trim().slice(0, 1000);
  if (!text || !(LOG_KINDS as readonly string[]).includes(entry.kind)) return { ok: false, message: t("tracker.errSave") };
  const db = await createClient();
  const { data, error: readError } = await db.from("tracked_jobs").select("log").eq("user_id", viewer.id).eq("job_id", jobId).maybeSingle();
  if (readError) return { ok: false, message: readError.code === "42703" ? t("tracker.errNotReady") : t("tracker.errSave") };
  const log = [...(((data?.log as LogEntry[] | undefined) ?? []).slice(-199)), { at: new Date().toISOString(), kind: entry.kind as LogEntry["kind"], text }];
  const { error } = await db.from("tracked_jobs").update({ log, updated_at: new Date().toISOString() }).eq("user_id", viewer.id).eq("job_id", jobId);
  if (error) return { ok: false, message: t("tracker.errSave") };
  revalidatePath("/tracker");
  return { ok: true };
}
