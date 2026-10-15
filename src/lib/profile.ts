import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import { withDefaults, type ProfileData } from "./profile-schema";

export type AccountProfile = {
  email: string;
  accountType: "seeker" | "company";
  companyName: string;
  website: string;
  companyDomainMatches: boolean;
  profile: ProfileData;
};

/** The signed-in person's profile; sends visitors who aren't signed in to /signin. */
export async function loadAccount(): Promise<AccountProfile> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data } = await supabase
    .from("profiles")
    .select("account_type, full_name, company_name, website, company_domain_matches, headline, location, status, links, resume")
    .eq("id", user.id)
    .single();

  return {
    email: user.email ?? "",
    accountType: data?.account_type === "company" ? "company" : "seeker",
    companyName: data?.company_name ?? "",
    website: data?.website ?? "",
    companyDomainMatches: Boolean(data?.company_domain_matches),
    profile: withDefaults({
      full_name: data?.full_name ?? "",
      headline: data?.headline ?? "",
      location: data?.location ?? "",
      status: data?.status === "student" ? "student" : "professional",
      links: Array.isArray(data?.links) ? data.links : [],
      resume: data?.resume && typeof data.resume === "object" ? data.resume : {},
    }),
  };
}
