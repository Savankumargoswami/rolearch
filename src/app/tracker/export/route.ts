// The member's application history as a CSV file (blueprint 7.4: export personal application history).
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { fromRow } from "@/lib/tracker";

const cell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything, and neutralise spreadsheet formulas in user-entered text.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  const viewer = await loadViewer();
  if (!viewer) return new Response("Sign in to export your applications.", { status: 401 });
  const db = await createClient();
  const { data } = await db.from("tracked_jobs").select("*").eq("user_id", viewer.id).order("created_at", { ascending: true });
  const rows = (data ?? []).map((r) => fromRow(r as Record<string, unknown>));
  const head = ["Title", "Company", "Status", "Saved", "Applied", "Deadline", "Interview", "Follow up", "Contact", "Contact email", "Rejection reason", "Link", "Notes", "History"];
  const lines = rows.map((j) =>
    [
      j.title,
      j.company,
      j.status,
      j.createdAt.slice(0, 10),
      j.appliedAt?.slice(0, 10) ?? "",
      j.deadline ?? "",
      j.interviewAt ?? "",
      j.followUpOn ?? "",
      j.contactName,
      j.contactEmail,
      j.rejectionReason,
      j.url,
      j.notes,
      j.log.map((e) => `${e.at.slice(0, 10)} ${e.kind}: ${e.text}`).join(" | "),
    ]
      .map(cell)
      .join(","),
  );
  const csv = "﻿" + [head.map(cell).join(","), ...lines].join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="rolearch-applications-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
