"use client";

import { ArrowRight, Bookmark, Check, ClipboardCheck, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { trackFromCheck } from "@/app/tracker/actions";
import type { AtsTarget } from "@/app/ats/actions";
import { t } from "@/i18n";

/**
 * "Track this application", right under the job-fit report: one click records that the member applied (or wants to)
 * in their tracker, linked to this fit check, so they get follow-up reminders and outcome stats.
 */
export function TrackApplication({ target, company }: { target: AtsTarget; company?: string }) {
  const [done, setDone] = useState<"applied" | "saved" | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [which, setWhich] = useState<"applied" | "saved">("applied");

  const save = (status: "applied" | "saved") =>
    start(async () => {
      setWhich(status);
      setError("");
      const res = await trackFromCheck(typeof target === "string" ? target : { ...target, company: target.company ?? company }, status).catch(() => ({
        ok: false as const,
        message: t("tracker.errSave"),
      }));
      if (res.ok) setDone(status);
      else setError(res.message);
    });

  if (done)
    return (
      <div role="status" className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-[#1f7a4d]/10 px-4 py-3 text-sm">
        <span className="inline-flex items-center gap-1.5 font-medium text-[#1f7a4d]">
          <Check aria-hidden="true" className="size-4" strokeWidth={2.5} />
          {done === "applied" ? t("trackApp.doneApplied") : t("trackApp.doneSaved")}
        </span>
        <Link href="/tracker" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
          {t("trackApp.open")}
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </div>
    );

  return (
    <section aria-labelledby="track-app-h" className="mt-5 rounded-2xl border border-line bg-surface p-4">
      <h3 id="track-app-h" className="flex items-center gap-2 font-semibold">
        <ClipboardCheck aria-hidden="true" className="size-4 text-signal-ink" />
        {t("trackApp.title")}
      </h3>
      <p className="mt-1 text-sm text-muted">{t("trackApp.lead")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => save("applied")}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-4 text-sm font-medium text-paper transition-transform hover:bg-ink-hover active:scale-[0.96] disabled:opacity-60"
        >
          {busy && which === "applied" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Check aria-hidden="true" className="size-4" />}
          {t("trackApp.applied")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => save("saved")}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 text-sm font-medium transition-transform hover:border-ink active:scale-[0.96] disabled:opacity-60"
        >
          {busy && which === "saved" ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Bookmark aria-hidden="true" className="size-4" />}
          {t("trackApp.later")}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#b4532a]">
          {error}
        </p>
      )}
    </section>
  );
}
