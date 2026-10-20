"use client";

import { CircleCheck } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { t } from "@/i18n";
import type { Question } from "@/lib/hiring";
import { applyToJob } from "./actions";

/** Screening questions and an optional note; the profile itself is attached on the server. */
export function ApplyForm({ jobId, company, questions }: { jobId: string; company: string; questions: Question[] }) {
  const id = useId();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div role="status" className="mt-6 rounded-2xl border border-line bg-signal/20 p-5">
        <p className="flex items-center gap-2 font-medium">
          <CircleCheck aria-hidden="true" className="size-5" />
          {t("apply.done")}
        </p>
        <Link href="/tracker" className="mt-3 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("apply.toTracker")}
        </Link>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await applyToJob(jobId, questions.map((q) => ({ q: q.q, a: answers[q.q] ?? "" })), note);
          if (res.ok) setDone(true);
          else setError(res.message);
        });
      }}
      className="mt-6 flex flex-col gap-6"
    >
      {questions.length > 0 && (
        <fieldset className="rounded-2xl border border-line bg-surface p-5">
          <legend className="px-1 font-display text-xl font-semibold">{t("apply.questionsTitle", { company })}</legend>
          <ol className="mt-2 flex flex-col gap-5">
            {questions.map((q, i) =>
              q.kind === "yesno" ? (
                <li key={q.q}>
                  <fieldset>
                    <legend className="font-medium">
                      {q.q} {q.required && <span className="text-sm font-normal text-muted">({t("apply.required")})</span>}
                    </legend>
                    <div className="mt-2 flex gap-2">
                      {(["yes", "no"] as const).map((v) => (
                        <label
                          key={v}
                          className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                            answers[q.q] === v ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`${id}-q${i}`}
                            value={v}
                            required={q.required}
                            checked={answers[q.q] === v}
                            onChange={() => setAnswers((a) => ({ ...a, [q.q]: v }))}
                            className="sr-only"
                          />
                          {v === "yes" ? t("apply.yes") : t("apply.no")}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                </li>
              ) : (
                <li key={q.q}>
                  <label htmlFor={`${id}-q${i}`} className="font-medium">
                    {q.q} {q.required && <span className="text-sm font-normal text-muted">({t("apply.required")})</span>}
                  </label>
                  <textarea
                    id={`${id}-q${i}`}
                    required={q.required}
                    maxLength={2000}
                    rows={3}
                    value={answers[q.q] ?? ""}
                    onChange={(e) => setAnswers((a) => ({ ...a, [q.q]: e.target.value }))}
                    className="mt-2 w-full resize-y rounded-xl border border-line bg-paper/40 px-4 py-3 outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]"
                  />
                </li>
              ),
            )}
          </ol>
        </fieldset>
      )}

      <div>
        <label htmlFor={`${id}-note`} className="font-medium">{t("apply.noteLabel")}</label>
        <textarea
          id={`${id}-note`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
          rows={4}
          placeholder={t("apply.notePlaceholder")}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]"
        />
      </div>

      {error && <p role="alert" className="rounded-xl border border-[#b4532a]/50 bg-[#b4532a]/5 p-4">{error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t("apply.sending") : t("apply.submit")}
      </button>
    </form>
  );
}
