import { NextResponse, type NextRequest } from "next/server";
import { dailyPost, topicFor, TOPICS, type Digest } from "@/lib/daily-post";

// Vercel Cron calls this every day (vercel.json) with "Authorization: Bearer $CRON_SECRET".
// It summarises the day's new US jobs for the day's topic and publishes an official Rolearch post.

export const maxDuration = 120;

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const DAY = 86_400_000;

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

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const p_secret = process.env.POST_REVIEW_SECRET;
  if (!URL_ || !KEY || !p_secret) return NextResponse.json({ error: "not configured" }, { status: 500 });

  // ?topic=remote runs a chosen topic (for testing); otherwise the day's topic, falling back to all new jobs.
  const now = new Date();
  const asked = TOPICS.find((t) => t.key === request.nextUrl.searchParams.get("topic"));
  try {
    for (const topic of asked ? [asked] : [topicFor(now), TOPICS[0]]) {
      const digest = await rpc<Digest>("jobs_digest", { p_secret, p_topic: topic.key, p_since: new Date(now.getTime() - DAY).toISOString() });
      const post = dailyPost(topic, digest, "24 hours");
      if (!post) continue;
      const id = await rpc<string>("publish_rolearch_post", { p_secret, p_body: post.body, p_link: post.link });
      return NextResponse.json({ ok: true, id, topic: topic.key, jobs: digest.total });
    }
    return NextResponse.json({ ok: true, skipped: "not enough new jobs" });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 502 });
  }
}
