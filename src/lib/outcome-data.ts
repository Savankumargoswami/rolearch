// Consented outcome data (db/041_outcome_data.sql): whether a member shares their tracker outcomes in anonymised
// totals, and the totals themselves (only groups of 10+ members and 30+ applications are ever published).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { createClient } from "./supabase/server";
import { dataKey } from "@/lib/supabase/data-key";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

export type Benchmark = { dimension: string; key: string; members: number; sent: number; responses: number; interviews: number; offers: number };

/** Does the signed-in member share their outcomes? False when unset or the table isn't there yet. */
export async function sharesOutcomes(userId: string): Promise<boolean> {
  try {
    const db = await createClient();
    const { data } = await db.from("outcome_consent").select("share").eq("user_id", userId).maybeSingle();
    return Boolean(data?.share);
  } catch {
    return false;
  }
}

/** Published totals across members who opted in, refreshed nightly. Empty until there's enough data. */
export async function benchmarks(): Promise<Benchmark[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("outcome-stats");
  if (!BASE || !dataKey) return [];
  try {
    const res = await fetch(`${BASE}/rest/v1/outcome_stats?select=dimension,key,members,sent,responses,interviews,offers`, {
      headers: { apikey: dataKey },
      cache: "no-store",
    });
    return res.ok ? ((await res.json()) as Benchmark[]) : [];
  } catch {
    return [];
  }
}

export const rate = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0);
