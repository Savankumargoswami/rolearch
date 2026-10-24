import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { t } from "@/i18n";
import { readShare } from "@/lib/share-card";

type Props = { params: Promise<{ code: string }> };

const headline = (c: NonNullable<ReturnType<typeof readShare>>) =>
  c.before !== null ? t("share.textImproved", { before: c.before, after: c.after, title: c.title }) : t("share.text", { after: c.after, title: c.title });

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const card = readShare(code);
  if (!card) return {};
  const title = headline(card);
  const image = { url: `/s/${code}/card.png`, width: 1200, height: 630, alt: title };
  return {
    title,
    description: t("share.pageLead"),
    robots: { index: false },
    openGraph: { title, description: t("share.pageLead"), images: [image] },
    twitter: { card: "summary_large_image", title, images: [image.url] },
  };
}

// A shared ATS score: the card, and a way for whoever sees it to check their own resume.
export default function SharedScore({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto my-20 aspect-[1200/630] max-w-3xl animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
      <Card params={params} />
    </Suspense>
  );
}

async function Card({ params }: Props) {
  const { code } = await params;
  const card = readShare(code);
  if (!card) notFound();
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center px-4 py-12 text-center sm:px-6 sm:py-20">
      {/* eslint-disable-next-line @next/next/no-img-element -- the generated card */}
      <img src={`/s/${code}/card.png`} alt={headline(card)} width={1200} height={630} className="w-full rounded-2xl border border-line shadow-sm" />
      <h1 className="mt-10 max-w-[20ch] font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">{t("share.pageTitle")}</h1>
      <p className="mt-4 max-w-[48ch] text-lg text-muted text-pretty">{t("share.pageLead")}</p>
      <Link href="/ats" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-7 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover">
        {t("share.pageCta")}
      </Link>
    </div>
  );
}
