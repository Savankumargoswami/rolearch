"use client";

import { BrainCircuit, Check, Loader2, MessageCircleQuestion, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { reviewForJob, strengthenBullet, type AtsTarget } from "@/app/ats/actions";
import { t, type MessageKey } from "@/i18n";
import type { AtsDoc } from "@/lib/ats-doc";
import type { BulletReview, Review } from "@/lib/resume-coach";

const TONE = (s: number) => (s >= 4 ? "bg-[#1f7a4d]/12 text-[#1f7a4d]" : s === 3 ? "bg-signal/20 text-signal-ink" : "bg-[#b4532a]/10 text-[#b4532a]");

/**
 * AI Recruiter Review: Rolearch's AI reads the resume against this job like a recruiter. Every bullet gets a score
 * with the reasons, requirements met in other words are shown with the exact resume quote, and weak bullets come
 * with a question. The candidate's answer, never a guess, is what makes a bullet stronger.
 */
export function RecruiterReview({ target, doc, onApply }: { target: AtsTarget; doc: AtsDoc; onApply: (from: string, to: string) => void }) {
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const [all, setAll] = useState(false);

  const run = () =>
    start(async () => {
      setError("");
      const res = await reviewForJob(target, doc).catch(() => ({ ok: false as const, message: t("ats.errUnexpected") }));
      if (res.ok) setReview(res.review);
      else setError(res.message);
    });

  if (!review) {
    return (
      <section aria-labelledby="review-h" className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-5">
        <p className="font-mono text-xs font-semibold tracking-[0.14em] text-signal-ink uppercase">{t("review.kicker")}</p>
        <h3 id="review-h" className="mt-1 flex items-center gap-2 font-display text-lg font-semibold">
          <BrainCircuit aria-hidden="true" className="size-5 text-signal-ink" />
          {t("review.title")}
        </h3>
        <p className="mt-1 text-sm text-muted">{t("review.lead")}</p>
        <ul className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
          {(["p1", "p2", "p3"] as const).map((k) => (
            <li key={k} className="flex gap-2">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#1f7a4d]" />
              {t(`review.${k}`)}
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={run}
          disabled={busy}
          className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:cursor-wait disabled:opacity-70"
        >
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
          {busy ? t("review.running") : t("review.run")}
        </button>
        {error && (
          <p role="alert" className="mt-2 text-sm text-[#b4532a]">
            {error}
          </p>
        )}
      </section>
    );
  }

  const weak = review.bullets.filter((b) => b.score <= 3);
  const shown = all ? review.bullets : weak.slice(0, 6);
  return (
    <section aria-labelledby="review-h" className="mt-6 rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <p className="font-mono text-xs font-semibold tracking-[0.14em] text-signal-ink uppercase">{t("review.kicker")}</p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <h3 id="review-h" className="flex items-center gap-2 font-display text-lg font-semibold">
          <BrainCircuit aria-hidden="true" className="size-5 text-signal-ink" />
          {t("review.title")}
        </h3>
        <p className="text-end">
          <span className="font-display text-3xl font-semibold tabular-nums">{review.score}</span>
          <span className="text-sm text-muted">/100</span>
          <span className="block text-xs text-muted">{t("review.scoreLabel")}</span>
        </p>
      </div>
      <p className="mt-2 text-sm">{review.summary}</p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {review.strengths.length > 0 && (
          <div className="rounded-xl bg-[#1f7a4d]/[0.07] p-3">
            <p className="text-sm font-semibold text-[#1f7a4d]">{t("review.strengths")}</p>
            <ul className="mt-1 list-disc space-y-1 ps-5 text-sm">
              {review.strengths.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        )}
        {review.fixes.length > 0 && (
          <div className="rounded-xl bg-signal/10 p-3">
            <p className="text-sm font-semibold text-signal-ink">{t("review.fixes")}</p>
            <ol className="mt-1 list-decimal space-y-1 ps-5 text-sm">
              {review.fixes.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </div>
        )}
      </div>

      {review.matches.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold">{t("review.matchesTitle")}</p>
          <p className="text-xs text-muted">{t("review.matchesLead")}</p>
          <ul className="mt-2 flex flex-col gap-2">
            {review.matches.map((m) => (
              <li key={m.requirement + m.evidence} className="rounded-xl border border-line p-3 text-sm">
                <span className="rounded-md bg-[#3b6ea5]/12 px-1.5 py-0.5 font-mono text-xs text-[#2c5585]">{m.requirement}</span>
                <span className="mt-1.5 block border-s-2 border-signal ps-2 italic">“{m.evidence}”</span>
                <span className="mt-1 block text-xs text-muted">{m.how}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="font-semibold">{t("review.bulletsTitle", { weak: weak.length, total: review.bullets.length })}</p>
          <button type="button" onClick={() => setAll((v) => !v)} className="min-h-9 cursor-pointer text-sm font-medium underline underline-offset-4">
            {all ? t("review.showWeak") : t("review.showAll")}
          </button>
        </div>
        <p className="text-xs text-muted">{t("review.bulletsLead")}</p>
        <ul className="mt-2 flex flex-col gap-2">
          {shown.map((b) => (
            <li key={b.text}>
              <BulletCard b={b} target={target} onApply={onApply} />
            </li>
          ))}
        </ul>
        {!all && weak.length === 0 && <p className="mt-2 text-sm text-muted">{t("review.allStrong")}</p>}
      </div>
    </section>
  );
}

function BulletCard({ b, target, onApply }: { b: BulletReview; target: AtsTarget; onApply: (from: string, to: string) => void }) {
  const [answer, setAnswer] = useState("");
  const [after, setAfter] = useState("");
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const strengthen = () =>
    start(async () => {
      setError("");
      const res = await strengthenBullet(target, { original: b.text, question: b.question, answer, requirement: b.requirement }).catch(() => ({
        ok: false as const,
        message: t("ats.errUnexpected"),
      }));
      if (res.ok) setAfter(res.after);
      else setError(res.message);
    });

  return (
    <div className="rounded-xl border border-line p-3 text-sm">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${TONE(b.score)}`}>{b.score}/5</span>
        <div className="min-w-0">
          <p className="text-xs text-muted">{b.section}</p>
          <p className={applied ? "text-muted line-through decoration-muted/60" : ""}>{b.text}</p>
          {b.issues.length > 0 && (
            <p className="mt-1 flex flex-wrap gap-1">
              {b.issues.map((i) => (
                <span key={i} className="rounded-md bg-ink-soft px-1.5 py-0.5 text-xs">
                  {t(`review.issue_${i}` as MessageKey)}
                </span>
              ))}
            </p>
          )}
          {b.requirement && <p className="mt-1 text-xs text-muted">{t("review.serves", { what: b.requirement })}</p>}
        </div>
      </div>
      {b.question && !applied && (
        <div className="mt-2 rounded-lg bg-paper/60 p-2.5">
          <p className="flex items-start gap-1.5 font-medium">
            <MessageCircleQuestion aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal-ink" />
            {b.question}
          </p>
          <label className="sr-only" htmlFor={`ans-${b.text.slice(0, 20)}`}>
            {t("review.answerLabel")}
          </label>
          <textarea
            id={`ans-${b.text.slice(0, 20)}`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t("review.answerPh")}
            className="mt-1.5 w-full resize-y rounded-lg border border-line bg-surface px-2 py-1.5"
          />
          <button
            type="button"
            onClick={strengthen}
            disabled={busy || answer.trim().length < 3}
            className="mt-1.5 inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-3 text-xs font-semibold text-paper disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-3.5 animate-spin" /> : <Sparkles aria-hidden="true" className="size-3.5" />}
            {busy ? t("review.strengthening") : t("review.strengthen")}
          </button>
          <p className="mt-1 text-xs text-muted">{t("review.answerNote")}</p>
        </div>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-[#b4532a]">
          {error}
        </p>
      )}
      {after && (
        <div className="mt-2 border-s-2 border-[#1f7a4d] ps-2">
          <p className="text-xs font-semibold tracking-wide text-[#1f7a4d] uppercase">{applied ? t("review.applied") : t("review.stronger")}</p>
          <p className="mt-0.5">{after}</p>
          {!applied && (
            <span className="mt-1.5 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  onApply(b.text, after);
                  setApplied(true);
                }}
                className="min-h-9 cursor-pointer rounded-full bg-[#1f7a4d] px-3 text-xs font-semibold text-white"
              >
                {t("review.use")}
              </button>
              <button type="button" onClick={() => setAfter("")} className="min-h-9 cursor-pointer rounded-full border border-line px-3 text-xs font-semibold">
                {t("ats.evKeep")}
              </button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
