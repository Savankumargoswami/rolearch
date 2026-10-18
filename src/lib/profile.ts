import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createClient } from "./supabase/server";
import { withDefaults, type ProfileData } from "./profile-schema";

export type AccountProfile = {
  id: string;
  email: string;
  accountType: "seeker" | "company";
  companyName: string;
  website: string;
  companyDomainMatches: boolean;
  avatarUrl: string;
  profile: ProfileData;
};

const COLUMNS = "id, account_type, full_name, company_name, website, company_domain_matches, headline, location, status, links, resume, avatar_url";

function toAccount(id: string, email: string, data: Record<string, unknown> | null): AccountProfile {
  const d = data ?? {};
  const str = (k: string) => (typeof d[k] === "string" ? (d[k] as string) : "");
  return {
    id,
    email,
    accountType: d.account_type === "company" ? "company" : "seeker",
    companyName: str("company_name"),
    website: str("website"),
    companyDomainMatches: Boolean(d.company_domain_matches),
    avatarUrl: str("avatar_url"),
    profile: withDefaults({
      full_name: str("full_name"),
      headline: str("headline"),
      location: str("location"),
      status: d.status === "student" ? "student" : "professional",
      links: Array.isArray(d.links) ? d.links : [],
      resume: d.resume && typeof d.resume === "object" ? (d.resume as ProfileData["resume"]) : undefined,
    }),
  };
}

/** The signed-in person's profile; sends visitors who aren't signed in to /signin. */
export async function loadAccount(): Promise<AccountProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");
  const { data } = await supabase.from("profiles").select(COLUMNS).eq("id", user.id).single();
  return toAccount(user.id, user.email ?? "", data);
}

/** Another member's profile (row-level security shows profiles to signed-in members only). */
export async function loadProfile(id: string): Promise<AccountProfile | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select(COLUMNS).eq("id", id).maybeSingle();
  return data ? toAccount(id, "", data) : null;
}

/** The signed-in member's profile, or null for visitors. Cached per request so page sections can share it. */
export const loadViewer = cache(async (): Promise<AccountProfile | null> => {
  const store = await cookies();
  if (!store.getAll().some((c) => c.name.startsWith("sb-"))) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("profiles").select(COLUMNS).eq("id", user.id).single();
  return toAccount(user.id, user.email ?? "", data);
});
