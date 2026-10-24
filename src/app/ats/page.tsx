import type { Metadata } from "next";
import { Suspense } from "react";
import { m, t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { FreeCheck } from "./free-check";

// The ATS check's actions run here: reading a resume and tailoring it take 20-40 seconds each.
export const maxDuration = 120;

export const metadata: Metadata = {
  title: t("atsFree.metaTitle"),
  description: t("atsFree.metaDescription"),
  alternates: { canonical: "/ats" },
};

export default function AtsPage() {
  const copy = m().atsFree;
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-sm font-semibold tracking-wide text-signal-ink uppercase">{t("atsFree.kicker")}</p>
      <h1 className="mt-3 max-w-[18ch] font-display text-4xl font-semibold leading-[1.03] tracking-[-0.03em] text-balance sm:text-6xl">{t("atsFree.h1")}</h1>
      <p className="mt-4 max-w-[60ch] text-lg text-muted text-pretty">{t("atsFree.lead")}</p>
      <ul className="mt-6 flex flex-wrap gap-2 text-sm">
        {copy.points.map((p) => (
          <li key={p} className="rounded-full bg-ink-soft px-3 py-1.5 font-medium">
            {p}
          </li>
        ))}
      </ul>
      <div className="mt-10">
        <Suspense fallback={<FreeCheck signedIn={false} hasProfile={false} />}>
          <ForViewer />
        </Suspense>
      </div>
      <p className="mt-8 max-w-[80ch] text-xs leading-relaxed text-muted">{t("ats.disclaimer")}</p>
    </div>
  );
}

async function ForViewer() {
  const viewer = await loadViewer();
  const p = viewer?.profile;
  return <FreeCheck signedIn={Boolean(viewer)} hasProfile={Boolean(p && p.resume.experience.length + p.resume.skills.length > 0)} />;
}
