"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { cleanPreferences, type Preferences } from "@/lib/preferences";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** Saves the member's job preferences (target roles, experience range, locations, work arrangement). */
export async function savePreferences(input: Preferences): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const p = cleanPreferences(input);
  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ preferences: { target_roles: p.targetRoles, experience: p.experience, locations: p.locations, work_mode: p.workMode } })
    .eq("id", viewer.id);
  if (error) return { ok: false, message: error.code === "42703" ? t("tracker.errNotReady") : t("profile.errSave") };
  revalidatePath("/discover");
  revalidatePath("/gaps");
  return { ok: true };
}

/** Open to work: lets verified employers find the member in talent search (off unless they switch it on). */
export async function setOpenToWork(on: boolean): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (viewer.accountType !== "seeker") return { ok: false, message: t("profile.errSave") };
  const db = await createClient();
  const { error } = await db
    .from("profiles")
    .update({ open_to_work: Boolean(on), open_to_work_at: on ? new Date().toISOString() : null })
    .eq("id", viewer.id);
  if (error) return { ok: false, message: error.code === "42703" ? t("tracker.errNotReady") : t("profile.errSave") };
  return { ok: true };
}
