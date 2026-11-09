import { BadgeCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { badgeTitle, loadBadge } from "@/lib/badge";
import { PASS_MARK } from "@/lib/skill-tests";

type Props = { params: Promise<{ code: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const b = await loadBadge(code);
  if (!b) return { robots: { index: false } };
  const title = badgeTitle(b);
  const description = `A verified skill badge: passed Rolearch's proctored ${b.skill} test at the ${b.level} level with ${Math.round(b.score)}%.`;
  const image = { url: `/badge/${code}/card.png`, width: 1200, height: 630, alt: title };
  return { title, description, robots: { index: false }, openGraph: { title, description, images: [image] }, twitter: { card: "summary_large_image", title, images: [image.url] } };
}

/** Public verification page for a passed skill test (the link members add to LinkedIn). */
export default function BadgePage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto my-20 h-80 max-w-2xl animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
      <Badge params={params} />
    </Suspense>
  );
}

async function Badge({ params }: Props) {
  const { code } = await params;
  const b = await loadBadge(code);
  if (!b) notFound();
  const date = new Date(b.issued).toLocaleDateString("en-US", { dateStyle: "long", timeZone: "UTC" });
  return (
    <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-20">
      <section className="rounded-3xl border border-[#2f6b3a]/30 bg-[#eef6ef] p-6 sm:p-8">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#2f6b3a]">
          <BadgeCheck aria-hidden="true" className="size-5" />
          Verified by Rolearch
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-0.025em] text-balance sm:text-4xl">
          {b.skill}
          <span className="block text-xl font-medium text-muted sm:text-2xl">{b.level} level</span>
        </h1>
        <dl className="mt-6 grid grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-muted">Score</dt>
            <dd className="font-display text-2xl font-semibold tabular-nums">{Math.round(b.score)}%</dd>
          </div>
          <div>
            <dt className="text-muted">Issued</dt>
            <dd className="font-medium">{date}</dd>
          </div>
          <div>
            <dt className="text-muted">Credential ID</dt>
            <dd className="font-mono font-medium">{b.id.slice(0, 8).toUpperCase()}</dd>
          </div>
        </dl>
      </section>
      <p className="mt-6 text-[0.95rem] text-muted">
        Rolearch skill tests are timed and proctored, with fresh questions each attempt. A badge needs {PASS_MARK}% or more. This page confirms the
        result; it doesn&rsquo;t show who took the test.
      </p>
      <div className="mt-8 rounded-3xl bg-ink p-6 text-paper">
        <h2 className="font-display text-xl font-semibold">Earn your own skill badges, free</h2>
        <p className="mt-1 text-[#dfe5ec]">Prove skills employers ask for, then add them to LinkedIn.</p>
        <Link href="/skills" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-signal px-5 font-medium text-ink hover:bg-[#ebb877]">
          See the skill tests
        </Link>
      </div>
    </div>
  );
}
