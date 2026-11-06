"use client";

import { ArrowUpRight, Lightbulb, Loader2, MessagesSquare, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import type { AnswerFeedback, PrepQuestion } from "@/lib/interview-prep";
import { prepFeedback, prepQuestions } from "./actions";

/** Interview preparation for one job: generate questions, practise answers, get feedback and knowledge gaps. */
export function InterviewPrep({ jobId, title, company }: { jobId: string; title: string; company: string }) {
  const [questions, setQuestions] = useState<PrepQuestion[] | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();

  const generate = () =>
    start(async () => {
      setError("");
      const res = await prepQuestions(jobId);
      if (res.ok) setQuestions(res.questions);
      else setError(res.message);
    });

  return (
    <section aria-labelledby="prep-h" className="mt-8">
      <div className="rounded-3xl bg-ink p-5 text-paper sm:p-6">
        <p className="text-xs font-semibold tracking-[0.14em] text-signal uppercase">{t("interview.eyebrow")}</p>
        <h2 id="prep-h" className="mt-1 font-display text-2xl font-semibold">
          {title} · {company}
        </h2>
        <p className="mt-2 max-w-[60ch] text-[#dfe5ec]">{t("interview.jobLead")}</p>
        {!questions && (
          <button
            type="button"
            onClick={generate}
            disabled={busy}
            className="mt-4 inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-signal px-6 font-medium text-ink hover:bg-[#ebb877] disabled:cursor-wait disabled:opacity-70"
          >
            {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
            {busy ? t("interview.generating") : t("interview.generate")}
          </button>
        )}
        {error && (
          <p role="alert" className="mt-3 text-sm font-medium text-signal">
            {error}
          </p>
        )}
      </div>
      {questions && (
        <ol className="mt-6 flex flex-col gap-5">
          {questions.map((q, i) => (
            <li key={i}>
              <QuestionCard n={i + 1} q={q} jobId={jobId} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function QuestionCard({ n, q, jobId }: { n: number; q: PrepQuestion; jobId: string }) {
  const [answer, setAnswer] = useState("");
  const [fb, setFb] = useState<AnswerFeedback | null>(null);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const check = () =>
    start(async () => {
      setError("");
      const res = await prepFeedback(jobId, q.question, answer);
      if (res.ok) setFb(res.feedback);
      else setError(res.message);
    });
  const tone = fb ? (fb.score >= 75 ? "text-[#1f7a4d]" : fb.score >= 50 ? "text-signal-ink" : "text-[#b4532a]") : "";

  return (
    <article className="rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,31,47,0.04),0_12px_32px_-18px_rgba(14,31,47,0.25)] sm:p-6">
      <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.12em] text-muted uppercase">
        <span className="grid size-6 place-items-center rounded-full bg-ink text-paper">{n}</span>
        {t(`interview.kind_${q.kind}` as MessageKey)}
      </p>
      <h3 className="mt-3 font-display text-xl font-semibold leading-snug">{q.question}</h3>
      <p className="mt-1 text-sm text-muted">{q.why}</p>
      <details className="mt-3 text-sm">
        <summary className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 font-medium underline decoration-line underline-offset-4">
          <Lightbulb aria-hidden="true" className="size-4" />
          {t("interview.hint")}
        </summary>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          {q.covers.map((c) => (
            <li key={c}>{c}</li>
          ))}
        </ul>
        <p className="mt-2 text-muted">{q.evidence ? t("interview.evidence", { evidence: q.evidence }) : t("interview.noEvidence")}</p>
      </details>
      <label className="mt-4 block text-sm font-medium" htmlFor={`a-${n}`}>
        {t("interview.yourAnswer")}
      </label>
      <textarea
        id={`a-${n}`}
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        rows={5}
        maxLength={6000}
        placeholder={t("interview.answerPlaceholder")}
        className="mt-1.5 w-full resize-y rounded-xl border border-line bg-paper/40 px-3 py-2 text-[0.95rem]"
      />
      <button
        type="button"
        onClick={check}
        disabled={busy || answer.trim().split(/\s+/).length < 15}
        className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <MessagesSquare aria-hidden="true" className="size-4" />}
        {busy ? t("interview.checking") : t("interview.check")}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-sm text-[#b4532a]">
          {error}
        </p>
      )}
      {fb && (
        <div className="mt-4 rounded-2xl bg-ink-soft/60 p-4 text-sm" aria-live="polite">
          <p className={`font-display text-3xl font-semibold tabular-nums ${tone}`}>
            {fb.score}
            <span className="text-base text-muted">/100</span>
          </p>
          {fb.strengths.length > 0 && <List title={t("interview.strengths")} items={fb.strengths} />}
          {fb.missing.length > 0 && <List title={t("interview.missing")} items={fb.missing} />}
          {fb.gaps.length > 0 && (
            <div className="mt-3">
              <List title={t("interview.gaps")} items={fb.gaps} />
              <p className="mt-1.5 flex flex-wrap gap-x-4">
                <Link href="/skills" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
                  {t("interview.gapTests")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
                <Link href="/roadmaps" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
                  {t("interview.gapRoadmaps")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </Link>
              </p>
            </div>
          )}
          {fb.better && (
            <div className="mt-3">
              <p className="font-semibold">{t("interview.better")}</p>
              <p className="mt-1 whitespace-pre-line">{fb.better}</p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5">
        {items.map((x) => (
          <li key={x}>{x}</li>
        ))}
      </ul>
    </div>
  );
}
