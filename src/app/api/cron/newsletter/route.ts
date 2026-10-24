import { NextResponse, type NextRequest } from "next/server";
import { newsletterHtml, SITE, TOPICS, type Digest, type Section } from "@/lib/daily-post";

// Vercel Cron calls this every Monday (vercel.json) with "Authorization: Bearer $CRON_SECRET".
// It builds the week's sections once per category members chose, and sends through Resend in batches of 100.

export const maxDuration = 300;

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const WEEK = 7 * 86_400_000;

type Recipient = { email: string; category: string; token: string };

async function rpc<T>(name: string, body: object): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: KEY!, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${name} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

const topic = (key: string) => TOPICS.find((t) => t.key === key);

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const p_secret = process.env.POST_REVIEW_SECRET;
  const resendKey = process.env.RESEND_API_KEY;
  if (!URL_ || !KEY || !p_secret || !resendKey) return NextResponse.json({ error: "not configured" }, { status: 500 });

  try {
    const recipients = await rpc<Recipient[]>("newsletter_recipients", { p_secret });
    if (recipients.length === 0) return NextResponse.json({ ok: true, sent: 0 });
    const p_since = new Date(Date.now() - WEEK).toISOString();
    const cache = new Map<string, Promise<Digest>>();
    const digest = (key: string) => {
      if (!cache.has(key)) cache.set(key, rpc<Digest>("jobs_digest", { p_secret, p_topic: key, p_since }));
      return cache.get(key)!;
    };

    // Everyone gets new, remote and pay; members who chose a field get that field first.
    const htmlFor = new Map<string, string>();
    const build = async (category: string, token: string) => {
      const keys = [...(topic(category) && !["new", "remote", "pay"].includes(category) ? [category] : []), "new", "remote", "pay"];
      const sections: Section[] = await Promise.all(keys.map(async (k) => ({ topic: topic(k)!, digest: await digest(k) })));
      const skills = sections[0].digest.skills.slice(0, 8);
      return newsletterHtml(sections, skills, `${SITE}/newsletter/unsubscribe?t=${token}`);
    };

    let sent = 0;
    const errors: string[] = [];
    for (let i = 0; i < recipients.length; i += 100) {
      const batch = recipients.slice(i, i + 100);
      const emails = await Promise.all(
        batch.map(async (r) => {
          // Sections depend only on the category; the unsubscribe link is per person.
          const key = r.category;
          if (!htmlFor.has(key)) htmlFor.set(key, await build(key, "__TOKEN__"));
          const unsubscribe = `${SITE}/api/newsletter/unsubscribe?t=${r.token}`;
          return {
            from: "Rolearch <noreply@rolearch.com>",
            to: [r.email],
            subject: "This week on Rolearch: new jobs straight from employers",
            html: htmlFor.get(key)!.replaceAll("__TOKEN__", r.token),
            headers: { "List-Unsubscribe": `<${unsubscribe}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
          };
        }),
      );
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(emails),
      });
      if (res.ok) sent += emails.length;
      else errors.push(`${res.status} ${await res.text()}`);
    }
    return NextResponse.json({ ok: errors.length === 0, sent, recipients: recipients.length, errors: errors.slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
