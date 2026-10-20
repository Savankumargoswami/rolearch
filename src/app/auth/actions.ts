"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-next";
import { t } from "@/i18n";
import { authConfigured, createClient } from "@/lib/supabase/server";

export type Field = "name" | "email" | "password" | "company" | "website";
// `values` refills the form after an error (React resets forms on submit); passwords are never sent back.
export type AuthState = { errors?: Partial<Record<Field, string>>; message?: string; sent?: string; values?: Record<string, string> };

// Personal inboxes can't prove someone works at a company.
const FREE_MAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "me.com",
  "aol.com", "proton.me", "protonmail.com", "gmx.com", "gmx.de", "yandex.com", "mail.com", "zoho.com", "qq.com", "163.com",
]);

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function hostOf(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return null;
  }
}

async function siteOrigin() {
  const h = await headers();
  return h.get("origin") ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}

/** Turns Supabase's error text into something a person can act on. */
function friendly(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("already registered") || m.includes("already exists")) return t("auth.errExists");
  if (m.includes("invalid login") || m.includes("invalid credentials")) return t("auth.errCredentials");
  if (m.includes("email not confirmed")) return t("auth.errNotConfirmed");
  if (m.includes("rate limit") || m.includes("too many")) return t("auth.errRateLimit");
  if (m.includes("password")) return t("auth.errPasswordWeak");
  return t("auth.errGeneric");
}

export async function signUp(_: AuthState, form: FormData): Promise<AuthState> {
  if (!authConfigured) return { message: t("auth.errNotConfigured") };
  const kind = form.get("kind") === "company" ? "company" : "seeker";
  const get = (k: string) => String(form.get(k) ?? "").trim();
  const name = get("name");
  const email = get("email").toLowerCase();
  const password = String(form.get("password") ?? "");
  const company = get("company");
  const website = get("website");

  const errors: AuthState["errors"] = {};
  if (kind === "seeker" && !name) errors.name = t("auth.errName");
  if (!emailOk(email)) errors.email = t("auth.errEmail");
  if (password.length < 10) errors.password = t("auth.errPassword");
  if (kind === "company") {
    if (!company) errors.company = t("auth.errCompany");
    const host = hostOf(website);
    if (!host || !host.includes(".")) errors.website = t("auth.errWebsite");
    else if (!errors.email) {
      const domain = email.split("@")[1];
      if (FREE_MAIL.has(domain)) errors.email = t("auth.errWorkEmail");
      else if (domain !== host) errors.email = t("auth.errDomain", { d: host });
    }
  }
  const values = { name, email, company, website };
  if (Object.keys(errors).length) return { errors, values };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(safeNext(form.get("next")))}`,
      data: kind === "company" ? { account_type: "company", full_name: name, company_name: company, website } : { account_type: "seeker", full_name: name },
    },
  });
  if (error) return { message: friendly(error.message), values };
  // Email confirmation off: Supabase signs the person in right away.
  if (data.session) redirect(safeNext(form.get("next")));
  return { sent: email };
}

/** Sends the sign-up confirmation email again (Supabase limits how often). */
export async function resendConfirmation(email: string, next: string): Promise<{ ok: boolean; message?: string }> {
  if (!authConfigured || !emailOk(email)) return { ok: false, message: t("auth.errGeneric") };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(safeNext(next))}` },
  });
  return error ? { ok: false, message: friendly(error.message) } : { ok: true };
}

export async function signIn(_: AuthState, form: FormData): Promise<AuthState> {
  if (!authConfigured) return { message: t("auth.errNotConfigured") };
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const errors: AuthState["errors"] = {};
  if (!emailOk(email)) errors.email = t("auth.errEmail");
  if (!password) errors.password = t("auth.errPasswordEmpty");
  if (Object.keys(errors).length) return { errors, values: { email } };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { message: friendly(error.message), values: { email } };
  redirect(safeNext(form.get("next")));
}

/** "Continue with Google / GitHub": sends the person to the provider, then back through /auth/confirm. */
export async function oauthSignIn(form: FormData): Promise<void> {
  const provider = form.get("provider") === "github" ? "github" : "google";
  const next = safeNext(form.get("next"));
  if (!authConfigured) redirect(`/signin?error=oauth`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${await siteOrigin()}/auth/confirm?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect(`/signin?error=oauth&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
