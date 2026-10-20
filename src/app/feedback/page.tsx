import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { FeedbackForm } from "./feedback-form";

export const metadata: Metadata = { title: "Feedback", robots: { index: false } };

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default function FeedbackPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Feedback />
      </Suspense>
    </div>
  );
}

async function Feedback() {
  const viewer = await requireMember("/feedback");
  const db = await createClient();
  const { data } = await db.from("feedback").select("created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(1);
  const last = data?.[0]?.created_at as string | undefined;
  return (
    <>
      <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("feedback.title")}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{t("feedback.lead")}</p>
      {last && <p className="mt-3 text-sm text-muted">{t("feedback.lastSent", { date: date.format(new Date(last)) })}</p>}
      <FeedbackForm company={viewer.accountType === "company"} />
    </>
  );
}
