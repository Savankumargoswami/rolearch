import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";

// The job import (GitHub Action, `finalize` step) calls this after each refresh with "Authorization: Bearer $CRON_SECRET",
// so job pages, search and totals pick up new, changed and closed jobs right away instead of within the hour.
// Stale-while-revalidate: visitors keep getting the cached page while the fresh one is built.
export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  revalidateTag("jobs", "max");
  return NextResponse.json({ ok: true });
}
