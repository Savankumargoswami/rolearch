import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile-view";
import { t } from "@/i18n";
import { loadProfile } from "@/lib/profile";
import { listPosts, loadSocial, viewerId } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("social.profileTitle"), robots: { index: false } };

export default function MemberPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Member params={params} />
      </Suspense>
    </div>
  );
}

/** Profiles are for signed-in members; visitors are sent to sign in first. */
async function Member({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const me = await viewerId(supabase);
  if (!me) redirect("/signin");
  if (me === id) redirect("/account");
  const account = await loadProfile(id);
  if (!account) notFound();
  const [social, posts] = await Promise.all([loadSocial(supabase, id, me), listPosts(supabase, { authorId: id }, 20)]);
  return <ProfileView account={account} mode="public" social={social} posts={posts} viewerId={me} />;
}
