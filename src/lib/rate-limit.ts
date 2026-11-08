// Per-member limits on the expensive AI features (resume reading, tailoring, rewrites, cover letters, interview
// prep), counted in the member's own ai_usage rows. Fails open if the table isn't there yet, so a missing migration
// never blocks people; the limits are generous for real use and stop runaway or scripted use.
import "server-only";
import { createClient } from "./supabase/server";

export const LIMITS = {
  read: { max: 20, minutes: 60 },
  tailor: { max: 10, minutes: 60 },
  rewrite: { max: 40, minutes: 60 },
  review: { max: 10, minutes: 60 },
  letter: { max: 10, minutes: 60 },
  prep: { max: 10, minutes: 60 },
  feedback: { max: 40, minutes: 60 },
} as const;
export type LimitKind = keyof typeof LIMITS;

/** True (and the use is counted) when the member is under the limit for this kind of action. */
export async function allow(userId: string, kind: LimitKind): Promise<boolean> {
  const { max, minutes } = LIMITS[kind];
  try {
    const db = await createClient();
    const since = new Date(Date.now() - minutes * 60_000).toISOString();
    const { count, error } = await db.from("ai_usage").select("at", { count: "exact", head: true }).eq("user_id", userId).eq("kind", kind).gte("at", since);
    if (error) return true;
    if ((count ?? 0) >= max) return false;
    await db.from("ai_usage").insert({ user_id: userId, kind });
    return true;
  } catch {
    return true;
  }
}
