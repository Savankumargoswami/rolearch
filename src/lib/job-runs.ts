// Once-per-period guard for scheduled jobs (db/039_job_runs.sql). Vercel Schedules can deliver a run more than once;
// claim() succeeds only for the first delivery of a period. release() undoes a claim when the job fails, so a manual
// re-run can try again. If the table isn't there yet, jobs run unguarded rather than not at all.
import "server-only";
import { dataKey } from "@/lib/supabase/data-key";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");

/** "2026-11-08" for daily jobs; the Monday of the ISO week for weekly ones. */
export function period(kind: "day" | "week", now = new Date()) {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  if (kind === "week") d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** True when this delivery is the first for (job, period). */
export async function claim(job: string, p: string): Promise<boolean> {
  if (!BASE || !dataKey) return true;
  const res = await fetch(`${BASE}/rest/v1/job_runs`, {
    method: "POST",
    headers: { apikey: dataKey, "Content-Type": "application/json", Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify({ job, period: p }),
    cache: "no-store",
  });
  if (!res.ok) {
    console.error(`[job-runs] claim ${job} ${p} failed: ${res.status}`);
    return true;
  }
  return ((await res.json()) as unknown[]).length > 0;
}

export async function release(job: string, p: string) {
  if (!BASE || !dataKey) return;
  await fetch(`${BASE}/rest/v1/job_runs?job=eq.${encodeURIComponent(job)}&period=eq.${encodeURIComponent(p)}`, {
    method: "DELETE",
    headers: { apikey: dataKey },
    cache: "no-store",
  }).catch(() => {});
}

/**
 * Runs a scheduled route's handler at most once per period: checks the cron secret, claims (job, period), and
 * releases the claim if the handler fails (an error response or a throw), so a re-run can try again.
 */
export async function once(job: string, kind: "day" | "week", request: Request, handler: (request: Request) => Promise<Response>): Promise<Response> {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  const p = period(kind);
  if (!(await claim(job, p))) return Response.json({ ok: true, skipped: `already ran for ${p}` });
  try {
    const res = await handler(request);
    if (res.status >= 400) await release(job, p);
    return res;
  } catch (e) {
    await release(job, p);
    throw e;
  }
}
