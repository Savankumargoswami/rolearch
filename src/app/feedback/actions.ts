"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { FEATURE_IDS } from "@/lib/feedback";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type FeedbackInput = {
  liked: string[];
  disliked: string[];
  likedNote: string;
  dislikedNote: string;
  wishlist: string;
  rating: number | null;
};

export async function sendFeedback(input: FeedbackInput): Promise<{ ok: boolean; message?: string }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const pick = (list: string[]) => [...new Set(list.filter((x) => FEATURE_IDS.includes(x)))];
  const row = {
    user_id: viewer.id,
    account_type: viewer.accountType,
    liked: pick(input.liked),
    disliked: pick(input.disliked),
    liked_note: input.likedNote.trim().slice(0, 2000),
    disliked_note: input.dislikedNote.trim().slice(0, 2000),
    wishlist: input.wishlist.trim().slice(0, 3000),
    rating: input.rating && input.rating >= 1 && input.rating <= 5 ? Math.round(input.rating) : null,
  };
  if (!row.liked.length && !row.disliked.length && !row.liked_note && !row.disliked_note && !row.wishlist && !row.rating) {
    return { ok: false, message: t("feedback.errEmpty") };
  }
  const db = await createClient();
  const { error } = await db.from("feedback").insert(row);
  if (error) {
    console.error("[feedback] save failed:", error.message);
    return { ok: false, message: t("feedback.errSave") };
  }
  revalidatePath("/feedback");
  return { ok: true };
}
