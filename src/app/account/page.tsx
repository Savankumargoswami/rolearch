import type { Metadata } from "next";
import { Suspense } from "react";
import { FeedbackPrompt } from "@/components/feedback-prompt";
import { NewsletterCard } from "@/components/newsletter-card";
import { ProfileView } from "@/components/profile-view";
import { t } from "@/i18n";
import { postReviewEnabled } from "@/lib/post-review";
import { loadAccount } from "@/lib/profile";
import { listPosts, loadSocial } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("auth.accountTitle"), robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Account />
      </Suspense>
      <Suspense fallback={null}>
        <FeedbackPrompt />
      </Suspense>
    </div>
  );
}

/** Reads the signed-in user, so it streams in behind the Suspense boundary. */
async function Account() {
  const account = await loadAccount();
  const supabase = await createClient();
  const [social, posts] = await Promise.all([loadSocial(supabase, account.id, account.id), listPosts(supabase, { authorId: account.id }, 20)]);
  return (
    <>
      <ProfileView account={account} mode="own" social={social} posts={posts} viewerId={account.id} canPost={postReviewEnabled} />
      <NewsletterCard userId={account.id} />
    </>
  );
}
