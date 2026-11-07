// A member's job preferences (blueprint 2.2 B onboarding): the roles they're targeting, their experience range,
// where they can work and how. Discovery and the career roadmap start from the first target role.
import "server-only";
import type { createClient } from "./supabase/server";

export const EXPERIENCE = ["0-2", "3-5", "6-10", "10+"] as const;
export const WORK_MODES = ["any", "remote", "hybrid", "onsite"] as const;
export type Preferences = { targetRoles: string[]; experience: string; locations: string[]; workMode: (typeof WORK_MODES)[number] };

export const emptyPreferences: Preferences = { targetRoles: [], experience: "", locations: [], workMode: "any" };

const list = (v: unknown, n: number) =>
  Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim().slice(0, 80)).filter(Boolean))].slice(0, n) : [];

export function cleanPreferences(raw: unknown): Preferences {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const exp = String(r.experience ?? r.experience_range ?? "");
  const mode = String(r.workMode ?? r.work_mode ?? "any");
  return {
    targetRoles: list(r.targetRoles ?? r.target_roles, 5),
    experience: (EXPERIENCE as readonly string[]).includes(exp) ? exp : "",
    locations: list(r.locations, 5),
    workMode: (WORK_MODES as readonly string[]).includes(mode) ? (mode as Preferences["workMode"]) : "any",
  };
}

type Db = Awaited<ReturnType<typeof createClient>>;

/** The member's preferences; empty before db/034 adds the column or before they've set any. */
export async function loadPreferences(db: Db, userId: string): Promise<Preferences> {
  const { data, error } = await db.from("profiles").select("preferences").eq("id", userId).maybeSingle();
  if (error || !data) return emptyPreferences;
  return cleanPreferences((data as { preferences?: unknown }).preferences);
}
