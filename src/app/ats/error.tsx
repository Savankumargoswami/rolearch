"use client";

import Link from "next/link";
import { useEffect } from "react";

// If the ATS page ever fails, show a way back and the error reference (it matches the server log line).
export default function AtsError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ats] page error", error);
  }, [error]);
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-4 py-20 sm:px-6">
      <h1 className="font-display text-3xl font-semibold">Something went wrong with the ATS check.</h1>
      <p className="text-muted">Try again. If it keeps happening, send us the reference below.</p>
      <p className="rounded-lg bg-ink-soft px-3 py-2 font-mono text-sm">Reference: {error.digest ?? error.message ?? "unknown"}</p>
      <div className="flex gap-3">
        <button type="button" onClick={reset} className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          Try again
        </button>
        <Link href="/" className="inline-flex min-h-11 items-center rounded-full border border-ink px-5 font-medium">
          Home
        </Link>
      </div>
    </div>
  );
}
