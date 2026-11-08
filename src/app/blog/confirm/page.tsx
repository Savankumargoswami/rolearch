import type { Metadata } from "next";
import { Suspense } from "react";
import { TokenAction } from "../token-action";

export const metadata: Metadata = { title: "Confirm your blog updates", robots: { index: false } };

type Search = Promise<{ t?: string }>;

export default function Page({ searchParams }: { searchParams: Search }) {
  return (
    <div className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.03em]">Confirm your blog updates</h1>
      <p className="mt-3 text-muted">One click and you&apos;ll get each new Rolearch article by email.</p>
      <Suspense fallback={null}>
        <Token searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Token({ searchParams }: { searchParams: Search }) {
  return <TokenAction token={(await searchParams).t ?? ""} kind="confirm" />;
}
