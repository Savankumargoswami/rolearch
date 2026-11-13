import { NextResponse, type NextRequest } from "next/server";
import { rest } from "@/lib/blog";
import { COMPETITORS, runWatch, watchEmail } from "@/lib/competitor-watch";
import { once } from "@/lib/job-runs";

// Vercel Schedules call this every Monday (vercel.json) with "Authorization: Bearer $CRON_SECRET". It researches what the
// competitors changed in the last 7 days, stores the notes (db/048, server-only) so next week can tell what's new, and
// emails the report to COMPETITOR_WATCH_TO (default admin@rolearch.com). ?preview=1 returns the email without sending.
export const maxDuration = 300;

async function run(request: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const preview = request.nextUrl.searchParams.has("preview");
  const week = new Date().toISOString().slice(0, 10);

  // Last week's notes per competitor, so the research doesn't report old news as new.
  const prev = await rest<{ competitor: string; notes: { changes: { title: string }[] } }[]>(
    `competitor_watch?select=competitor,notes&week=lt.${week}&order=week.desc&limit=${COMPETITORS.length}`,
  ).catch(() => []);
  const lastWeek: Record<string, string> = {};
  for (const p of prev ?? []) if (!(p.competitor in lastWeek)) lastWeek[p.competitor] = (p.notes?.changes ?? []).map((c) => c.title).join("; ");

  const result = await runWatch(lastWeek);
  const mail = watchEmail(week, result);
  if (preview) return new NextResponse(mail.html, { headers: { "content-type": "text/html; charset=utf-8" } });

  await rest("competitor_watch?on_conflict=week,competitor", {
    method: "POST",
    prefer: "resolution=merge-duplicates",
    body: JSON.stringify(result.reports.map((r) => ({ week, competitor: r.competitor, notes: r }))),
  }).catch((e) => console.error("[competitor-watch] save failed:", (e as Error).message));

  const key = process.env.RESEND_API_KEY;
  if (!key) return NextResponse.json({ error: "RESEND_API_KEY not set" }, { status: 500 });
  const to = (process.env.COMPETITOR_WATCH_TO ?? "admin@rolearch.com").split(",").map((s) => s.trim()).filter(Boolean);
  const send = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: "Rolearch <noreply@rolearch.com>", to, subject: mail.subject, html: mail.html }),
  });
  if (!send.ok) return NextResponse.json({ error: `send failed: ${send.status} ${await send.text()}` }, { status: 502 });
  return NextResponse.json({ ok: true, changes: result.reports.reduce((a, r) => a + r.changes.length, 0), failed: result.failed });
}

// At most once per week: Vercel Schedules can deliver a run twice (lib/job-runs.ts). A preview doesn't use up the week.
export function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.has("preview")) {
    const secret = process.env.CRON_SECRET;
    if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    return run(request);
  }
  return once("competitor-watch", "week", request, (r) => run(r as NextRequest));
}
