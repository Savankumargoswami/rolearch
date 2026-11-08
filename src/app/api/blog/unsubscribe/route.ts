import { NextResponse, type NextRequest } from "next/server";
import { setSubscription } from "@/lib/blog";

// One-click unsubscribe (RFC 8058) for blog emails: mail apps POST here from the List-Unsubscribe header.
// People who open the link land on /blog/unsubscribe, which asks first (link scanners only GET).

export async function POST(request: NextRequest) {
  const ok = await setSubscription(request.nextUrl.searchParams.get("t") ?? "", "unsubscribe");
  return NextResponse.json({ ok }, { status: ok ? 200 : 400 });
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL(`/blog/unsubscribe?t=${encodeURIComponent(request.nextUrl.searchParams.get("t") ?? "")}`, request.url));
}
