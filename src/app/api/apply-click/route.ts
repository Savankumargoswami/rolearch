import { NextResponse, type NextRequest } from "next/server";
import { supabaseUrl } from "@/lib/supabase/server";
import { dataKey } from "@/lib/supabase/data-key";

// Counts a click on a job's apply link (db/051): which job and when, nothing about who clicked.
// Sent with navigator.sendBeacon, so the link itself never waits on it.
const BOT = /bot|crawl|spider|slurp|preview|headless|lighthouse/i;

export async function POST(request: NextRequest) {
  if (BOT.test(request.headers.get("user-agent") || "")) return new NextResponse(null, { status: 204 });
  let id = "";
  try {
    id = String(((await request.json()) as { id?: unknown }).id || "");
  } catch {}
  if (!id || id.length > 300 || !supabaseUrl || !dataKey) return new NextResponse(null, { status: 204 });
  await fetch(`${supabaseUrl}/rest/v1/rpc/record_apply_click`, {
    method: "POST",
    headers: { apikey: dataKey, "Content-Type": "application/json" },
    body: JSON.stringify({ p_job_id: id }),
    cache: "no-store",
  }).catch(() => undefined);
  return new NextResponse(null, { status: 204 });
}
