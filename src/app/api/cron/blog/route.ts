import { revalidateTag } from "next/cache";
import { NextResponse, type NextRequest } from "next/server";
import { industry, planFor, postEmail, rest, sendMail, type Post } from "@/lib/blog";
import { writePost, type Hiring } from "@/lib/blog-writer";

// Vercel Schedules call this 4 times a week: Sunday, Monday, Wednesday and Friday at 12:00 UTC (vercel.json) with "Authorization: Bearer $CRON_SECRET". It researches and
// publishes the next blog article in the rotation, then emails it to confirmed subscribers of that industry or of all.

export const maxDuration = 300;
const DAY = 86_400_000;

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: "not configured" }, { status: 500 });

  try {
    // One article per run, and never two within 20 hours (a retried or doubled run publishes nothing; the closest
    // scheduled runs, Sunday and Monday, are 24 hours apart).
    const last = await rest<{ published_at: string }[]>("blog_posts?select=published_at&order=published_at.desc&limit=1");
    if (last[0] && Date.now() - Date.parse(last[0].published_at) < 20 * 3_600_000 && !request.nextUrl.searchParams.has("force")) {
      return NextResponse.json({ ok: true, skipped: "published recently" });
    }
    const count = await rest<{ id: string }[]>("blog_posts?select=id", { prefer: "count=exact" }).then((r) => r.length);
    const { industry: ind } = planFor(count);

    let hiring: Hiring | null = null;
    const p_secret = process.env.POST_REVIEW_SECRET;
    if (p_secret) {
      hiring = await rest<Hiring>("rpc/jobs_digest", {
        method: "POST",
        body: JSON.stringify({ p_secret, p_topic: ind.cat, p_since: new Date(Date.now() - 14 * DAY).toISOString() }),
      }).catch(() => null);
    }

    const post = await writePost(count, hiring);
    const [saved] = await rest<Post[]>("blog_posts", { method: "POST", body: JSON.stringify(post), prefer: "return=representation" });
    revalidateTag("blog", "max");

    // Email confirmed subscribers who chose this industry or everything.
    const subs = await rest<{ email: string; token: string }[]>(
      `blog_subscribers?select=email,token&confirmed=eq.true&unsubscribed=eq.false&industry=in.(all,${ind.key})`,
    );
    const mails = subs.map((s) => ({ to: s.email, token: s.token, ...postEmail(saved, s.token) }));
    const result = mails.length ? await sendMail(mails) : { sent: 0, errors: [] };
    await rest(`blog_posts?slug=eq.${saved.slug}`, { method: "PATCH", body: JSON.stringify({ emailed_at: new Date().toISOString() }) });

    return NextResponse.json({ ok: true, slug: saved.slug, industry: industry(saved.industry)?.name, emailed: result.sent, errors: result.errors.slice(0, 3) });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message.slice(0, 500) }, { status: 502 });
  }
}
