"use server";

import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

// Saves or removes this device's job-alert subscription (db/052). The daily send (api/cron/job-alerts) posts to the
// endpoint, so only the browsers' own push services are accepted, never an arbitrary address.
const PUSH_HOST = /(^|\.)(fcm\.googleapis\.com|android\.googleapis\.com|push\.services\.mozilla\.com|push\.apple\.com|notify\.windows\.com)$/;
const MAX_DEVICES = 10;

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

function valid(s: Sub): { endpoint: string; p256dh: string; auth: string } | null {
  const endpoint = String(s?.endpoint ?? "");
  const p256dh = String(s?.keys?.p256dh ?? "");
  const auth = String(s?.keys?.auth ?? "");
  try {
    const u = new URL(endpoint);
    if (u.protocol !== "https:" || !PUSH_HOST.test(u.hostname) || endpoint.length > 1000) return null;
  } catch {
    return null;
  }
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,100}$/.test(auth)) return null;
  return { endpoint, p256dh, auth };
}

export async function savePushSubscription(sub: Sub): Promise<{ ok: boolean; error?: "signedOut" | "invalid" | "failed" }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, error: "signedOut" };
  const s = valid(sub);
  if (!s) return { ok: false, error: "invalid" };
  const db = await createClient();
  await db.from("push_subscriptions").delete().eq("endpoint", s.endpoint);
  const { data: mine } = await db.from("push_subscriptions").select("endpoint").order("created_at", { ascending: true });
  if (mine && mine.length >= MAX_DEVICES) await db.from("push_subscriptions").delete().eq("endpoint", mine[0].endpoint);
  const { error } = await db.from("push_subscriptions").insert({ user_id: viewer.id, ...s });
  if (error) {
    console.error("[push] save failed:", error.message);
    return { ok: false, error: "failed" };
  }
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  const viewer = await loadViewer();
  if (!viewer || !endpoint) return { ok: false };
  const db = await createClient();
  const { error } = await db.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: !error };
}
