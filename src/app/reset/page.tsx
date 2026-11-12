import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/i18n";
import { RequestResetForm } from "./reset-forms";

export const metadata: Metadata = { title: t("auth.resetTitle"), robots: { index: false } };

export default function ResetPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-12 sm:px-6 sm:py-20">
      <Suspense fallback={<RequestResetForm linkExpired={false} />}>
        <WithError searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function WithError({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  return <RequestResetForm linkExpired={error === "link"} />;
}
