"use server";

import { confirmEmail, industry, rest, sendMail, setSubscription } from "@/lib/blog";

type Result = { ok: boolean; message: string };
const EMAIL = /^[^@\s]{1,64}@[^@\s]+\.[^@\s]{2,}$/;

/**
 * Blog email updates, double opt-in: the address gets a confirmation link and nothing else until it's clicked.
 * The same address gets at most one confirmation email per 10 minutes, so the form can't be used to flood an inbox.
 */
export async function subscribe(form: FormData): Promise<Result> {
  if (String(form.get("website") ?? "")) return { ok: true, message: "Check your inbox for a confirmation link." }; // bots fill the hidden field
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const ind = String(form.get("industry") ?? "all");
  if (!EMAIL.test(email) || email.length > 254) return { ok: false, message: "Enter a valid email address." };
  const choice = industry(ind) ? ind : "all";
  try {
    const [have] = await rest<{ token: string; confirmed: boolean; unsubscribed: boolean; confirm_sent_at: string | null }[]>(
      `blog_subscribers?select=token,confirmed,unsubscribed,confirm_sent_at&email=eq.${encodeURIComponent(email)}`,
    );
    if (have?.confirmed && !have.unsubscribed) {
      await rest(`blog_subscribers?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify({ industry: choice }) });
      return { ok: true, message: "You're already subscribed. We've updated your topic." };
    }
    if (have?.confirm_sent_at && Date.now() - Date.parse(have.confirm_sent_at) < 10 * 60_000) {
      return { ok: true, message: "We just sent a confirmation link. Check your inbox (and spam folder)." };
    }
    const row = { industry: choice, confirmed: false, unsubscribed: false, confirm_sent_at: new Date().toISOString() };
    const [saved] = have
      ? await rest<{ token: string }[]>(`blog_subscribers?email=eq.${encodeURIComponent(email)}`, { method: "PATCH", body: JSON.stringify(row), prefer: "return=representation" })
      : await rest<{ token: string }[]>("blog_subscribers", { method: "POST", body: JSON.stringify({ email, ...row }), prefer: "return=representation" });
    const { sent, errors } = await sendMail([{ to: email, ...confirmEmail(saved.token) }]);
    if (!sent) {
      console.error("[blog] confirmation email failed:", errors[0]);
      return { ok: false, message: "We couldn't send the confirmation email right now. Please try again later." };
    }
    return { ok: true, message: "Almost done: check your inbox for a confirmation link." };
  } catch (e) {
    console.error("[blog] subscribe failed:", (e as Error).message);
    return { ok: false, message: "Something went wrong. Please try again." };
  }
}

export async function unsubscribeBlog(token: string): Promise<boolean> {
  return setSubscription(token, "unsubscribe");
}

export async function confirmBlog(token: string): Promise<boolean> {
  return setSubscription(token, "confirm");
}
