"use client";

import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { setOutcomeSharing } from "./actions";

/** The opt-in for anonymised outcome totals. Off unless the member turns it on. */
export function OutcomeSharing({ initial, compact = false }: { initial: boolean; compact?: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const toggle = () =>
    start(async () => {
      setError("");
      const next = !on;
      const res = await setOutcomeSharing(next);
      if (res.ok) setOn(next);
      else setError(res.message ?? "");
    });
  return (
    <div className={compact ? "" : "rounded-2xl border border-line bg-surface p-5"}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{t("outcomeShare.title")}</p>
          <p className="mt-1 text-sm text-muted">{t("outcomeShare.lead")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={t("outcomeShare.title")}
          disabled={busy}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${on ? "bg-[#1f7a4d]" : "bg-ink/25"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${on ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
      {!compact && (
        <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">
          <li>{t("outcomeShare.p1")}</li>
          <li>{t("outcomeShare.p2")}</li>
          <li>{t("outcomeShare.p3")}</li>
        </ul>
      )}
      <p role="status" className="mt-2 text-xs text-muted">
        {on ? t("outcomeShare.on") : t("outcomeShare.off")}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-[#b4532a]">
          {error}
        </p>
      )}
    </div>
  );
}
