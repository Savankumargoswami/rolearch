import type { Metadata } from "next";
import { Suspense } from "react";
import { t } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { PrivacyControls } from "./privacy-controls";

export const metadata: Metadata = { title: "Settings and privacy", robots: { index: false } };

const POINTS = ["stored", "private", "ai", "noTraining", "scores", "employers"] as const;

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("privacy.title")}</h1>
      <p className="mt-2 text-muted">{t("privacy.lead")}</p>
      <ul className="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5 text-sm">
        {POINTS.map((p) => (
          <li key={p} className="flex gap-2">
            <span aria-hidden="true" className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-ink" />
            <span>{t(`privacy.p_${p}`)}</span>
          </li>
        ))}
      </ul>
      <Suspense fallback={null}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  await requireMember("/account/privacy");
  return <PrivacyControls />;
}
