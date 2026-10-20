import { NextResponse, type NextRequest } from "next/server";
import { digestHtml, summarise, type FeedbackRow } from "@/lib/feedback-digest";

// Vercel Cron calls this every Monday (vercel.json) with "Authorization: Bearer $CRON_SECRET".
// It reads the last 7 days of feedback, summarises it, and emails the digest through Resend.

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const WEEK = 7 * 86_400_000;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (!URL_ || !KEY || !process.env.POST_REVIEW_SECRET || !resendKey) {
    return NextResponse.json({ error: "not configured" }, { status: 500 });
  }

  const to = new Date();
  const from = new Date(to.getTime() - WEEK);
  const res = await fetch(`${URL_}/rest/v1/rpc/feedback_since`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_secret: process.env.POST_REVIEW_SECRET, p_since: from.toISOString() }),
    cache: "no-store",
  });
  if (!res.ok) return NextResponse.json({ error: `feedback read failed: ${res.status}` }, { status: 502 });
  const rows = (await res.json()) as FeedbackRow[];

  const summary = await summarise(rows);
  const recipients = (process.env.FEEDBACK_DIGEST_TO ?? "admin@rolearch.com").split(",").map((s) => s.trim()).filter(Boolean);
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Rolearch <noreply@rolearch.com>",
      to: recipients,
      subject: `Rolearch weekly feedback: ${rows.length} response${rows.length === 1 ? "" : "s"}`,
      html: digestHtml(rows, summary, from, to),
    }),
  });
  if (!send.ok) return NextResponse.json({ error: `send failed: ${send.status} ${await send.text()}` }, { status: 502 });
  return NextResponse.json({ ok: true, responses: rows.length, summarised: Boolean(summary) });
}
