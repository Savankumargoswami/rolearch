import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileView } from "@/components/profile-view";
import { t } from "@/i18n";
import { loadAccount } from "@/lib/profile";

export const metadata: Metadata = { title: t("auth.accountTitle"), robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <Account />
      </Suspense>
    </div>
  );
}

/** Reads the signed-in user, so it streams in behind the Suspense boundary. */
async function Account() {
  return <ProfileView account={await loadAccount()} />;
}
