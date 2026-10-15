import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Keeps Supabase sign-in sessions fresh: refreshes the access token and writes the new cookies. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Nothing to refresh for visitors who never signed in.
  if (!url || !key || !request.cookies.getAll().some((c) => c.name.startsWith("sb-"))) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
      },
    },
  });
  // Validates the session with Supabase and refreshes it if it's about to expire.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Skip static files, images and metadata routes.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|apple-icon.png|opengraph-image|brand/|pwa-|robots.txt|sitemap.xml|manifest.webmanifest).*)"],
};
