import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "") ?? "";
export const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";
export const authConfigured = Boolean(supabaseUrl && supabaseKey);

/** Supabase client bound to this request's cookies (Server Components, Server Actions, Route Handlers). */
export async function createClient() {
  const store = await cookies();
  return createServerClient(supabaseUrl, supabaseKey, {
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
