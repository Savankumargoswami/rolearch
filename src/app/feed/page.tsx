import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { t } from "@/i18n";
import { matchesProfile } from "@/lib/hiring-match";
import { postReviewEnabled } from "@/lib/post-review";
import { loadViewer } from "@/lib/profile";
import { listPosts, viewerId } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("posts.feedTitle"), robots: { index: false } };

type Search = Promise<{ tab?: string }>;

export default function FeedPage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">{t("posts.feedTitle")}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{t("posts.feedLead")}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <Feed searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const tabClass = (active: boolean) =>
  `inline-flex min-h-11 items-center rounded-full px-4 font-medium transition-colors duration-200 ${active ? "bg-ink text-paper" : "text-ink hover:bg-ink-soft"}`;

async function Feed({ searchParams }: { searchParams: Search }) {
  const supabase = await createClient();
  const me = await viewerId(supabase);
  if (!me) redirect("/signin");
  const tab = (await searchParams).tab;
  const following = tab === "following";
  const hiring = tab === "hiring";
  const [loaded, viewer] = await Promise.all([listPosts(supabase, following ? { followedBy: me } : hiring ? { kind: "hiring" } : {}, 40), loadViewer()]);
  // Hiring posts that fit the member's role and place are marked, and come first on the Hiring tab.
  const marked = loaded.map((p) => (p.kind === "hiring" && p.author.id !== me ? { ...p, matches: matchesProfile(p.hiring, viewer?.profile ?? null) } : p));
  const posts = hiring ? [...marked].sort((a, b) => Number(b.matches ?? false) - Number(a.matches ?? false)) : marked;
  return (
    <div className="mt-8 flex flex-col gap-5">
      <PostComposer enabled={postReviewEnabled} />
      <nav aria-label={t("posts.feedTitle")} className="flex gap-2">
        <Link href="/feed" aria-current={following || hiring ? undefined : "page"} className={tabClass(!following && !hiring)}>
          {t("posts.tabEveryone")}
        </Link>
        <Link href="/feed?tab=following" aria-current={following ? "page" : undefined} className={tabClass(following)}>
          {t("posts.tabFollowing")}
        </Link>
        <Link href="/feed?tab=hiring" aria-current={hiring ? "page" : undefined} className={tabClass(hiring)}>
          {t("posts.tabHiring")}
        </Link>
      </nav>
      <PostList posts={posts} viewerId={me} empty={following ? t("posts.emptyFollowing") : hiring ? t("posts.emptyHiring") : t("posts.emptyEveryone")} />
    </div>
  );
}
