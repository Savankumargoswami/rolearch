import "server-only";
import { cacheLife } from "next/cache";
import { supabaseKey, supabaseUrl } from "./supabase/server";

export type Providers = { google: boolean; github: boolean };

/** Which social sign-ins are switched on in Supabase, so we never show a button that leads to an error. */
export async function enabledProviders(): Promise<Providers> {
  "use cache";
  cacheLife("minutes");
  if (!supabaseUrl || !supabaseKey) return { google: false, github: false };
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, { headers: { apikey: supabaseKey }, cache: "no-store" });
    const external = res.ok ? ((await res.json()).external ?? {}) : {};
    return { google: Boolean(external.google), github: Boolean(external.github) };
  } catch {
    return { google: false, github: false };
  }
}
