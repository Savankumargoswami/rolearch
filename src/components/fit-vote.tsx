"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import { useState, useTransition } from "react";
import { rateFit } from "@/app/fit/actions";
import { t } from "@/i18n";

/** "Was this match right for you?": one tap, used to measure how relevant the recommendations are. */
export function FitVote({ jobId, verdict, score, place }: { jobId: string; verdict: string; score: number; place: "discover" | "jobs" | "job" | "ats" }) {
  const [vote, setVote] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const send = (relevant: boolean) =>
    start(async () => {
      setError("");
      const res = await rateFit(jobId, relevant, verdict, score, place);
      if (res.ok) setVote(relevant);
      else setError(res.message ?? "");
    });
  if (vote !== null) return <p className="text-xs text-muted">{t("fit.voteThanks")}</p>;
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
      <span>{t("fit.voteAsk")}</span>
      <button type="button" disabled={busy} onClick={() => send(true)} aria-label={t("fit.voteYes")} className="grid size-8 cursor-pointer place-items-center rounded-full border border-line hover:border-ink">
        <ThumbsUp aria-hidden="true" className="size-3.5" />
      </button>
      <button type="button" disabled={busy} onClick={() => send(false)} aria-label={t("fit.voteNo")} className="grid size-8 cursor-pointer place-items-center rounded-full border border-line hover:border-ink">
        <ThumbsDown aria-hidden="true" className="size-3.5" />
      </button>
      {error && <span className="text-[#b4532a]">{error}</span>}
    </div>
  );
}
