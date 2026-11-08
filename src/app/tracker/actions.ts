"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getJob } from "@/data/db";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { track } from "@/lib/events";
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
  // Moving an existing job (e.g. "I applied") is recorded in its history, as on the tracker page.
  const { data: cur } = await db.from("tracked_jobs").select("*").eq("user_id", viewer.id).eq("job_id", jobId).maybeSingle();
  const row = cur as Record<string, unknown> | null;
  const log =
    row && row.status !== status && Array.isArray(row.log)
      ? [...(row.log as LogEntry[]).slice(-199), { at: now, kind: "status" as const, text: `${String(row.status)}→${status}` }]
      : undefined;
  const { error } = await db.from("tracked_jobs").upsert(
    {
      user_id: viewer.id,
      job_id: jobId,
      ...(log ? { log } : {}),
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
  await track(viewer.id, "application_saved", { status, job_family: job.category ?? "" });
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
  // A status change is recorded in the job's history (blueprint 7.6: timestamped, reversible).
  let log: LogEntry[] | undefined;
  if (patch.status) {
    const { data: cur } = await db.from("tracked_jobs").select("*").eq("user_id", viewer.id).eq("job_id", jobId).maybeSingle();
    const row = cur as Record<string, unknown> | null;
    if (row && row.status !== patch.status && Array.isArray(row.log)) {
      log = [...(row.log as LogEntry[]).slice(-199), { at: now, kind: "status", text: `${String(row.status)}→${patch.status}` }];
    }
  }
  const { error } = await db
    .from("tracked_jobs")
    .update({
      ...(log ? { log } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.status === "applied" ? { applied_at: now } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes.slice(0, 4000) } : {}),
      updated_at: now,
    })
    .eq("user_id", viewer.id)
    .eq("job_id", jobId);
  if (error) return { ok: false, message: t("tracker.errSave") };
  if (patch.status) await track(viewer.id, "application_outcome_updated", { outcome: patch.status });
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

type CheckedJob = string | { title: string; description: string; company?: string; url?: string };

/**
 * "Track this application" after a job-fit check: a Rolearch job is tracked by its id; a pasted job description by
 * the same key its fit analysis was saved under (see jobFor in ats/actions.ts), so the verdict and the outcome link up.
 */
export async function trackFromCheck(target: CheckedJob, status: "applied" | "saved"): Promise<TrackResult> {
  if (status !== "applied" && status !== "saved") return { ok: false, message: t("tracker.errSave") };
  if (typeof target === "string") return trackJob(target, status);
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const title = String(target?.title ?? "").trim().slice(0, 200);
  const description = String(target?.description ?? "").trim().slice(0, 50000);
  if (!title || description.length < 200) return { ok: false, message: t("tracker.errSave") };
  const key = `pasted-${createHash("sha256").update(`${title}\n${description}`).digest("hex").slice(0, 32)}`;
  const raw = String(target.url ?? "").trim();
  const url = /^https?:\/\/[^\s]{3,500}$/.test(raw) ? raw : "";
  const db = await createClient();
  const now = new Date().toISOString();
  const { data: cur } = await db.from("tracked_jobs").select("status,log").eq("user_id", viewer.id).eq("job_id", key).maybeSingle();
  const prev = cur as { status: string; log: LogEntry[] } | null;
  const log = prev && prev.status !== status && Array.isArray(prev.log) ? [...prev.log.slice(-199), { at: now, kind: "status" as const, text: `${prev.status}→${status}` }] : undefined;
  const { error } = await db.from("tracked_jobs").upsert(
    {
      user_id: viewer.id,
      job_id: key,
      ...(log ? { log } : {}),
      status,
      title,
      company: String(target.company ?? "").trim().slice(0, 120),
      url,
      updated_at: now,
      ...(status === "applied" ? { applied_at: now } : {}),
    },
    { onConflict: "user_id,job_id" },
  );
  if (error) return { ok: false, message: t("tracker.errSave") };
  await track(viewer.id, "application_saved", { status, job_family: "pasted" });
  revalidatePath("/tracker");
  return { ok: true };
}
