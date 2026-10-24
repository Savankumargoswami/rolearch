import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/i18n";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: t("newsletter.unsubTitle"), robots: { index: false } };

type Search = Promise<{ t?: string }>;

export default function UnsubscribePage({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">{t("newsletter.unsubTitle")}</h1>
      <p className="mt-3 text-muted">{t("newsletter.unsubLead")}</p>
      <Suspense fallback={null}>
        <Token searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Token({ searchParams }: { searchParams: Search }) {
  const token = (await searchParams).t ?? "";
  return <UnsubscribeButton token={token} />;
}
