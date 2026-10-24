import { NextResponse, type NextRequest } from "next/server";
import { unsubscribe } from "@/lib/newsletter";

// One-click unsubscribe (RFC 8058): mail apps POST here from the List-Unsubscribe header.
// People who open the link land on /newsletter/unsubscribe, which asks before unsubscribing (link scanners only GET).

export async function POST(request: NextRequest) {
  const ok = await unsubscribe(request.nextUrl.searchParams.get("t") ?? "");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(`/newsletter/unsubscribe?t=${encodeURIComponent(request.nextUrl.searchParams.get("t") ?? "")}`, request.url));
}
