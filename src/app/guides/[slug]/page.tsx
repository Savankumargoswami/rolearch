import { ArrowRight, BadgeCheck, Hammer, Repeat2, Target } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { t } from "@/i18n";
import { GUIDES, guide } from "@/lib/transition-guides";

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = guide((await params).slug);
  if (!g) return { robots: { index: false } };
  const title = t("guides.metaTitle", { from: g.from, to: g.to });
  return { title, description: t("guides.metaDescription", { from: g.from.toLowerCase(), to: g.to.toLowerCase() }), alternates: { canonical: `/guides/${g.slug}` } };
}

/** A public career-change guide: what carries over, what to learn, the proof to build, and a fit check. */
export default function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-4xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Guide params={params} />
    </Suspense>
  );
}

async function Guide({ params }: { params: Promise<{ slug: string }> }) {
  const g = guide((await params).slug);
  if (!g) notFound();
  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Link href="/guides" className="text-sm text-muted hover:text-ink">
        {t("guides.all")}
      </Link>
      <p className="mt-4 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("guides.eyebrow")}</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{t("guides.h1", { from: g.from, to: g.to })}</h1>
      <p className="mt-3 max-w-[62ch] text-lg text-muted">{t("guides.lead", { from: g.from.toLowerCase(), to: g.to.toLowerCase() })}</p>

      <ol className="mt-8 flex flex-col gap-2 sm:flex-row sm:items-center">
        {[g.from, g.bridge, g.to].map((step, i) => (
          <li key={step} className="flex items-center gap-2 sm:contents">
            <span className={`rounded-2xl px-4 py-3 font-medium ${i === 2 ? "bg-ink text-paper" : "border border-line bg-surface"}`}>
              <span className="block text-xs font-semibold tracking-wide uppercase opacity-70">{i === 0 ? t("gaps.moveNow") : i === 2 ? t("gaps.moveGoal") : t("gaps.moveBridge")}</span>
              {step}
            </span>
            {i < 2 && (
              <span aria-hidden="true" className="text-muted sm:px-1">
                →
              </span>
            )}
          </li>
        ))}
      </ol>

      <section aria-labelledby="carry-h" className="mt-10">
        <h2 id="carry-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Repeat2 aria-hidden="true" className="size-6" />
          {t("guides.carryTitle")}
        </h2>
        <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {g.carries.map((c) => (
            <div key={c.skill} className="grid gap-1 p-4 sm:grid-cols-[14rem_1fr] sm:gap-6">
              <dt className="font-semibold">{c.skill}</dt>
              <dd className="text-muted">{c.how}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-sm text-muted">{t("guides.honest")}</p>
      </section>

      <section aria-labelledby="learn-h" className="mt-10">
        <h2 id="learn-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Target aria-hidden="true" className="size-6" />
          {t("guides.learnTitle")}
        </h2>
        <ol className="mt-3 list-decimal space-y-1.5 ps-6">
          {g.learn.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="proof-h" className="mt-10">
        <h2 id="proof-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Hammer aria-hidden="true" className="size-6" />
          {t("guides.proofTitle")}
        </h2>
        <ul className="mt-3 list-disc space-y-1.5 ps-6">
          {g.projects.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
        <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
          {t("guides.tests")}{" "}
          {g.tests.map((x, i) => (
            <span key={x}>
              <Link href="/skills" className="font-medium underline underline-offset-4">
                {x}
              </Link>
              {i < g.tests.length - 1 ? "," : ""}
            </span>
          ))}
        </p>
      </section>

      <section className="mt-12 rounded-3xl bg-ink p-6 text-paper sm:p-8">
        <h2 className="font-display text-2xl font-semibold">{t("guides.ctaTitle", { to: g.to.toLowerCase() })}</h2>
        <p className="mt-2 max-w-[56ch] text-[#dfe5ec]">{t("guides.ctaBody")}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/discover?role=${encodeURIComponent(g.to)}`} className="inline-flex min-h-12 items-center gap-2 rounded-full bg-signal px-6 font-medium text-ink hover:bg-[#ebb877]">
            {t("guides.ctaFit")}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <Link href={`/gaps?role=${encodeURIComponent(g.to)}`} className="inline-flex min-h-12 items-center gap-2 rounded-full border border-white/40 px-6 font-medium hover:border-signal">
            {t("guides.ctaRoadmap")}
          </Link>
        </div>
      </section>
    </article>
  );
}
