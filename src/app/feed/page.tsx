import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PostList } from "@/components/post-card";
import { PostComposer } from "@/components/post-composer";
import { t } from "@/i18n";
import { postReviewEnabled } from "@/lib/post-review";
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
  const following = (await searchParams).tab === "following";
  const posts = await listPosts(supabase, following ? { followedBy: me } : {}, 40);
  return (
    <div className="mt-8 flex flex-col gap-5">
      <PostComposer enabled={postReviewEnabled} />
      <nav aria-label={t("posts.feedTitle")} className="flex gap-2">
        <Link href="/feed" aria-current={following ? undefined : "page"} className={tabClass(!following)}>
          {t("posts.tabEveryone")}
        </Link>
        <Link href="/feed?tab=following" aria-current={following ? "page" : undefined} className={tabClass(following)}>
          {t("posts.tabFollowing")}
        </Link>
      </nav>
      <PostList posts={posts} viewerId={me} empty={following ? t("posts.emptyFollowing") : t("posts.emptyEveryone")} />
    </div>
  );
}
