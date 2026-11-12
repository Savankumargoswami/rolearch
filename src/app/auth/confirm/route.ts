import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/safe-next";
import { createClient } from "@/lib/supabase/server";

/** The link in the confirmation email lands here; we finish sign-in and send the person on. */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // Only redirect within this site.
  const destination = safeNext(searchParams.get("next"));
  const supabase = await createClient();

  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && type
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : { error: new Error("missing code") };

  // Password reset links (type=recovery, or sent with next=/reset/new) go to the new-password form, or back to the
  // reset page when the link has expired.
  const recovery = type === "recovery" || destination.startsWith("/reset/new");
  if (recovery) return NextResponse.redirect(new URL(error ? "/reset?error=link" : "/reset/new", origin));
  // A provider that says no (e.g. the person cancelled) sends ?error=... instead of a code.
  if (searchParams.get("error")) return NextResponse.redirect(new URL("/signin?error=oauth", origin));
  return NextResponse.redirect(new URL(error ? "/signin?error=link" : destination, origin));
}
