// Is the job-fit score validated? Read from db/042 (nightly, on applications members chose to share). Rolearch only
// claims the score predicts interviews when the evidence is strong; until then this returns null and nothing is shown.
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { dataKey } from "@/lib/supabase/data-key";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

type Row = { kind: string; key: string; n: number; interviews: number; rate: number; lo: number; hi: number; auc: number | null; updated_at: string };
export type Validation = { n: number; auc: number; high: Row; low: Row; bands: Row[]; updatedAt: string };

/** The bar for saying the score works: 200+ applications, 20+ interviews, better than chance by a clear margin, and
 *  high-score applications ahead of low-score ones with 95% intervals that don't overlap. */
const MIN_N = 200;
const MIN_INTERVIEWS = 20;
const MIN_AUC = 0.6;
const MIN_BAND = 30;

export async function fitValidation(): Promise<Validation | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("fit-validation");
  if (!BASE || !dataKey) return null;
  let rows: Row[];
  try {
    const res = await fetch(`${BASE}/rest/v1/fit_validation?select=*`, { headers: { apikey: dataKey }, cache: "no-store" });
    if (!res.ok) return null;
    rows = (await res.json()) as Row[];
  } catch {
    return null;
  }
  const all = rows.find((r) => r.kind === "summary");
  if (!all || all.auc === null || all.n < MIN_N || all.interviews < MIN_INTERVIEWS || all.auc < MIN_AUC) return null;
  const order = ["0-39", "40-59", "60-79", "80-100"];
  const bands = rows.filter((r) => r.kind === "band" && r.n >= MIN_BAND).sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  if (bands.length < 2) return null;
  const low = bands[0];
  const high = bands[bands.length - 1];
  if (high.lo <= low.hi) return null;
  return { n: all.n, auc: all.auc, high, low, bands, updatedAt: all.updated_at };
}
