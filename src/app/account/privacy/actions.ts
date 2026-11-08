"use server";

import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** Everything Rolearch keeps about the member, as one JSON file (Settings & Privacy: export). */
export async function exportMyData(): Promise<{ ok: true; filename: string; json: string } | { ok: false; message: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const own = async (table: string, cols = "*") => {
    const { data } = await db.from(table).select(cols).eq("user_id", viewer.id).limit(5000);
    return data ?? [];
  };
  const [tracked, versions, analyses, corrections, votes, badges, attempts, applications] = await Promise.all([
    own("tracked_jobs"),
    own("resume_versions"),
    own("job_analyses"),
    own("fit_corrections"),
    own("fit_feedback"),
    own("skill_badges"),
    own("skill_attempts", "id,skill,level,attempt_no,status,started_at,submitted_at,score,passed"),
    db.from("applications").select("id,job_id,stage,created_at,updated_at,answers,note").eq("applicant_id", viewer.id).then((r) => r.data ?? []),
  ]);
  const data = {
    exportedAt: new Date().toISOString(),
    account: { email: viewer.email, accountType: viewer.accountType },
    profile: viewer.profile,
    trackedJobs: tracked,
    resumeVersions: versions,
    jobFitAnalyses: analyses,
    jobFitCorrections: corrections,
    matchFeedback: votes,
    skillBadges: badges,
    skillTestAttempts: attempts,
    applications,
  };
  return { ok: true, filename: `rolearch-data-${new Date().toISOString().slice(0, 10)}.json`, json: JSON.stringify(data, null, 2) };
}

/** Deletes the member's uploaded files, then their account and everything tied to it (db/034 delete_my_account). */
export async function deleteMyAccount(confirmEmail: string): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (String(confirmEmail ?? "").trim().toLowerCase() !== viewer.email.toLowerCase()) return { ok: false, message: t("privacy.errConfirm") };
  const db = await createClient();
  for (const bucket of ["resumes", "avatars"]) {
    const { data } = await db.storage.from(bucket).list(viewer.id, { limit: 1000 });
    const paths = (data ?? []).map((f) => `${viewer.id}/${f.name}`);
    if (paths.length) await db.storage.from(bucket).remove(paths);
  }
  const { error } = await db.rpc("delete_my_account");
  if (error) return { ok: false, message: error.code === "PGRST202" ? t("tracker.errNotReady") : t("privacy.errDelete") };
  await db.auth.signOut();
  return { ok: true };
}

/** Opt in or out of adding my application outcomes to Rolearch's anonymised totals (db/041). */
export async function setOutcomeSharing(share: boolean): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const { error } = await db.from("outcome_consent").upsert({ user_id: viewer.id, share: Boolean(share), updated_at: new Date().toISOString() });
  if (error) {
    console.error("[outcomes] consent save failed:", error.message);
    return { ok: false, message: t("outcomeShare.errSave") };
  }
  return { ok: true };
}
