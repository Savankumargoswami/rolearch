import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ProfileEditor } from "@/components/profile-editor";
import { t } from "@/i18n";
import { loadAccount } from "@/lib/profile";
import { resumeReaderEnabled } from "@/lib/resume-reader";

export const metadata: Metadata = { title: t("profile.editTitle"), robots: { index: false } };

export default function EditProfilePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 pt-8 sm:px-6 sm:pt-12">
      <Link href="/account" className="inline-flex min-h-11 items-center gap-2 text-muted hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4 rtl:rotate-180" />
        {t("profile.backToProfile")}
      </Link>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-0.03em]">{t("profile.editTitle")}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{t("profile.editLead")}</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <Editor />
      </Suspense>
    </div>
  );
}

async function Editor() {
  const { profile } = await loadAccount();
  return <ProfileEditor initial={profile} readerEnabled={resumeReaderEnabled} />;
}
