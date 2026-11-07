"use client";

import { Flag, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { reportAnalysis, setCorrection } from "@/app/fit/actions";
import { t, type MessageKey } from "@/i18n";
import type { Correction, Tier } from "@/lib/fit";

/**
 * The candidate's corrections for one requirement (blueprint 5.5): "I have this" / "I don't have this" for anything
 * without direct evidence, and "This evidence is wrong" for a match. Saved to the profile and used on the next check.
 */
export function CorrectionButtons({ skill, tier, corrected }: { skill: string; tier: Tier; corrected: Correction | null }) {
  const [state, setState] = useState<Correction | null>(corrected);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const send = (kind: Correction | null) =>
    start(async () => {
      setError("");
      const res = await setCorrection(skill, kind);
      if (res.ok) {
        setState(kind);
        setSaved(true);
      } else setError(res.message ?? "");
    });
  const direct = tier === "verified" || tier === "proven";
  const options: Correction[] = direct ? ["wrong"] : ["have", "lack"];
  return (
    <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
      {state ? (
        <>
          <span className="text-muted">{t(`fit.corrMarked_${state}` as MessageKey)}</span>
          <button type="button" disabled={busy} onClick={() => send(null)} className="min-h-8 cursor-pointer font-medium underline underline-offset-2">
            {t("fit.corrUndo")}
          </button>
        </>
      ) : (
        <>
          <span className="text-muted">{t("fit.corrIntro")}</span>
          {options.map((k) => (
            <button
              key={k}
              type="button"
              disabled={busy}
              onClick={() => send(k)}
              className="min-h-8 cursor-pointer rounded-full border border-line px-2.5 font-medium hover:border-ink disabled:opacity-50"
            >
              {t(k === "have" ? "fit.corrHave" : k === "lack" ? "fit.corrLack" : "fit.corrWrong")}
            </button>
          ))}
        </>
      )}
      {busy && <Loader2 aria-hidden="true" className="size-3.5 animate-spin" />}
      {saved && !busy && <span className="w-full text-[#1f7a4d]">{t("fit.corrSaved")}</span>}
      {error && <span className="w-full text-[#b4532a]">{error}</span>}
    </span>
  );
}

const KINDS = ["wrong_match", "wrong_fact", "privacy", "other"] as const;

/** "Report a problem with this analysis": wrong match, wrong fact, privacy concern or other, with a note. */
export function ReportProblem({ jobKey, version }: { jobKey: string; version: string }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("wrong_match");
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  if (done) return <p className="mt-5 border-t border-line pt-4 text-sm text-muted">{t("fit.reportThanks")}</p>;
  return (
    <div className="mt-5 border-t border-line pt-4 text-sm">
      {!open ? (
        <button type="button" onClick={() => setOpen(true)} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 font-medium underline underline-offset-4">
          <Flag aria-hidden="true" className="size-4" />
          {t("fit.reportLink")}
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("fit.reportKind")}</span>
            <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])} className="h-10 rounded-lg border border-line bg-surface px-2">
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`fit.rk_${k}`)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">{t("fit.reportNote")}</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className="rounded-lg border border-line bg-paper/40 px-2 py-1.5" />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              start(async () => {
                setError("");
                const res = await reportAnalysis(jobKey, kind, note, version);
                if (res.ok) setDone(true);
                else setError(res.message ?? "");
              })
            }
            className="inline-flex min-h-10 w-fit cursor-pointer items-center gap-2 rounded-full bg-ink px-4 font-medium text-paper hover:bg-ink-hover disabled:opacity-50"
          >
            {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
            {t("fit.reportSend")}
          </button>
          {error && <p className="text-[#b4532a]">{error}</p>}
        </div>
      )}
    </div>
  );
}
