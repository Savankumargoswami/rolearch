"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { isCategory } from "@/lib/categories";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { unsubscribe } from "@/lib/newsletter";

export async function setNewsletter(subscribed: boolean, category: string): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const supabase = await createClient();
  const row = { subscribed, category: isCategory(category) ? category : "all", updated_at: new Date().toISOString() };
  // Members may update only these columns (db/024), and an upsert also rewrites user_id: update, or insert the first time.
  const { data: have } = await supabase.from("newsletter").select("user_id").eq("user_id", viewer.id).maybeSingle();
  const { error } = have
    ? await supabase.from("newsletter").update(row).eq("user_id", viewer.id)
    : await supabase.from("newsletter").insert({ user_id: viewer.id, ...row });
  if (error) {
    console.error("[newsletter] save failed:", error.message);
    return { ok: false, message: t("newsletter.errSave") };
  }
  revalidatePath("/account");
  return { ok: true };
}

export async function unsubscribeToken(token: string): Promise<boolean> {
  return unsubscribe(token);
}
