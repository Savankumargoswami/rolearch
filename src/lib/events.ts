// Product analytics events (blueprint 10.1). Event names and small, non-sensitive properties only: never resume
// text, job descriptions, names or contact details. Fails soft: analytics must never break a user action.
import "server-only";
import { createClient } from "./supabase/server";

export type ProductEvent =
  | "resume_uploaded"
  | "jobfit_completed"
  | "requirement_feedback"
  | "document_generated"
  | "claim_reviewed"
  | "application_saved"
  | "application_outcome_updated";

type Prop = string | number | boolean | null;

export async function track(userId: string | null | undefined, event: ProductEvent, props: Record<string, Prop> = {}): Promise<void> {
  if (!userId) return;
  try {
    const clean = Object.fromEntries(Object.entries(props).slice(0, 12).map(([k, v]) => [k.slice(0, 40), typeof v === "string" ? v.slice(0, 60) : v]));
    const db = await createClient();
    await db.from("product_events").insert({ user_id: userId, event, props: clean });
  } catch {}
}

/** Score bands keep analytics coarse: "0-39", "40-54", "55-74", "75-100". */
export const band = (n: number) => (n < 40 ? "0-39" : n < 55 ? "40-54" : n < 75 ? "55-74" : "75-100");
