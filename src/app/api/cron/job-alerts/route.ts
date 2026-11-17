import { NextResponse, type NextRequest } from "next/server";
import webpush from "web-push";
import { t } from "@/i18n";
import { once } from "@/lib/job-runs";
import { dataKey } from "@/lib/supabase/data-key";
import { supabaseUrl } from "@/lib/supabase/server";

// Vercel Cron calls this once a day (vercel.json) with "Authorization: Bearer $CRON_SECRET". For each member who turned
// on job alerts (db/052), it counts jobs for their first target role posted in the last day and, when there are any,
// sends "12 new Data Analyst jobs" to their devices. Members without a target role get nothing.

export const maxDuration = 300;

const DAY = 86_400_000;
const LOOK = 50; // newest jobs checked per role; "50+ new" beyond that

type Recipient = { endpoint: string; p256dh: string; auth: string; target_role: string | null };

async function rpc<T>(name: string, body: object): Promise<T> {
  const res = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: dataKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${text.slice(0, 200)}`);
  return (text ? JSON.parse(text) : null) as T; // void functions answer with an empty body
}

/** Jobs for this role posted in the last day (up to LOOK). */
async function newJobs(role: string): Promise<number> {
  const rows = await rpc<{ posted_at: string | null }[]>("search_jobs", {
    q: role.slice(0, 100), cat: "", region_in: "", remote_only: false, visa_only: false, pay_only: false, lvl: "",
    sort: "newest", lim: LOOK, off: 0, near_lat: null, near_lon: null, near_only: false, country_in: "", match_any: false,
  });
  const since = Date.now() - DAY;
  return rows.filter((r) => r.posted_at && Date.parse(r.posted_at) >= since).length;
}

async function run() {
  const p_secret = process.env.POST_REVIEW_SECRET;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!supabaseUrl || !dataKey || !p_secret || !publicKey || !privateKey) return NextResponse.json({ error: "not configured" }, { status: 500 });
  webpush.setVapidDetails("mailto:noreply@rolearch.com", publicKey, privateKey);

  const recipients = (await rpc<Recipient[]>("push_recipients", { p_secret })).filter((r) => r.target_role);
  const roles = new Map<string, string>(); // lowercased -> as the member wrote it
  for (const r of recipients) if (!roles.has(r.target_role!.toLowerCase())) roles.set(r.target_role!.toLowerCase(), r.target_role!);
  const counts = new Map<string, number>();
  for (const [key, role] of roles) counts.set(key, await newJobs(role).catch(() => 0));

  const sent: string[] = [];
  const gone: string[] = [];
  let failed = 0;
  const queue = recipients.filter((r) => (counts.get(r.target_role!.toLowerCase()) ?? 0) > 0);
  for (let i = 0; i < queue.length; i += 20) {
    await Promise.all(
      queue.slice(i, i + 20).map(async (r) => {
        const role = roles.get(r.target_role!.toLowerCase())!;
        const n = counts.get(role.toLowerCase())!;
        const payload = JSON.stringify({
          title: n === 1 ? t("jobAlerts.pushTitleOne", { role }) : t("jobAlerts.pushTitleMany", { n: n >= LOOK ? `${LOOK}+` : n, role }),
          body: t("jobAlerts.pushBody"),
          url: `/jobs?q=${encodeURIComponent(role)}&sort=newest&utm_source=push&utm_medium=notification&utm_campaign=job-alert`,
          tag: "job-alert",
        });
        try {
          await webpush.sendNotification({ endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } }, payload, { TTL: DAY / 1000, urgency: "normal" });
          sent.push(r.endpoint);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) gone.push(r.endpoint);
          else failed++;
        }
      }),
    );
  }
  if (sent.length || gone.length) await rpc("push_sent", { p_secret, p_sent: sent, p_gone: gone });
  return NextResponse.json({ ok: true, devices: recipients.length, roles: roles.size, sent: sent.length, removed: gone.length, failed });
}

// At most once per day: Vercel Schedules can deliver a run twice (lib/job-runs.ts).
export function GET(request: NextRequest) {
  return once("job-alerts", "day", request, async () => {
    try {
      return await run();
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 502 });
    }
  });
}
