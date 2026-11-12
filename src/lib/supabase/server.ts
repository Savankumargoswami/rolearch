import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { sessionCookieOptions } from "./cookie-options";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authConfigured = Boolean(supabaseUrl && supabaseKey);

/** Supabase client bound to this request's cookies (Server Components, Server Actions, Route Handlers). */
export async function createClient() {
  // Session reads are per request: without this, prefetch prerendering runs Supabase's session code (which reads the
  // clock) and logs "Date.now() while prerendering" errors on every signed-in page.
  await connection();
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
    cookieOptions: sessionCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) store.set(name, value, options);
        } catch {
          // Called from a Server Component, which can't set cookies; the proxy refreshes the session instead.
        }
      },
    },
  });
}
