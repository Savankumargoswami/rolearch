import { ArrowRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { t } from "@/i18n";
import { GUIDES } from "@/lib/transition-guides";

export const metadata: Metadata = { title: t("guides.indexTitle"), description: t("guides.indexLead"), alternates: { canonical: "/guides" } };

export default function GuidesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("guides.eyebrow")}</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{t("guides.indexTitle")}</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-muted">{t("guides.indexLead")}</p>
      <ul className="mt-8 grid gap-3 sm:grid-cols-2">
        {GUIDES.map((g) => (
          <li key={g.slug}>
            <Link href={`/guides/${g.slug}`} className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 hover:border-ink">
              <span>
                <span className="block font-display text-lg font-semibold">{t("guides.h1", { from: g.from, to: g.to })}</span>
                <span className="text-sm text-muted">{t("guides.via", { bridge: g.bridge })}</span>
              </span>
              <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
