"use client";

import { Plus, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import type { Question } from "@/lib/hiring";
import { postJob } from "../actions";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]";
const EMPLOYMENT = ["full_time", "part_time", "contract", "temporary", "internship"] as const;

/** The post-a-job form. The server action runs Claude's review and publishes the job if it passes. */
export function PostJobForm({ enabled, company }: { enabled: boolean; company: string }) {
  const id = useId();
  const router = useRouter();
  const [workplace, setWorkplace] = useState<"onsite" | "hybrid" | "remote">("onsite");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [status, setStatus] = useState<{ kind: "error" | "rejected"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [description, setDescription] = useState("");

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    data.set("workplace", workplace);
    data.set("questions", JSON.stringify(questions));
    setStatus(null);
    start(async () => {
      const res = await postJob(data);
      if (res.ok && res.id) router.push(`/hire/jobs/${res.id}?posted=1`);
      else if (!res.ok) setStatus({ kind: res.rejected ? "rejected" : "error", text: res.message });
    });
  }

  const label = "block font-medium";
  const hint = "mt-1 text-sm text-muted";

  return (
    <form onSubmit={submit} className="mt-8 flex flex-col gap-7" aria-describedby={`${id}-note`}>
      <p className="text-sm text-muted">{company}</p>

      <div>
        <label htmlFor={`${id}-title`} className={label}>{t("hire.fTitle")}</label>
        <p id={`${id}-title-h`} className={hint}>{t("hire.fTitleHint")}</p>
        <input id={`${id}-title`} name="title" required minLength={3} maxLength={160} aria-describedby={`${id}-title-h`} className={`${field} mt-2 h-12`} />
      </div>

      <fieldset>
        <legend className={label}>{t("hire.fWorkplace")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["onsite", "hybrid", "remote"] as const).map((w) => (
            <label
              key={w}
              className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-4 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                workplace === w ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"
              }`}
            >
              <input type="radio" name="workplace-choice" value={w} checked={workplace === w} onChange={() => setWorkplace(w)} className="sr-only" />
              {t(`hire.w${w === "onsite" ? "Onsite" : w === "hybrid" ? "Hybrid" : "Remote"}` as MessageKey)}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-5 sm:grid-cols-[2fr_1fr]">
        <div>
          <label htmlFor={`${id}-loc`} className={label}>{t("hire.fLocation")}</label>
          <p id={`${id}-loc-h`} className={hint}>{t("hire.fLocationHint")}</p>
          <input id={`${id}-loc`} name="location" required={workplace !== "remote"} maxLength={120} aria-describedby={`${id}-loc-h`} className={`${field} mt-2 h-12`} />
        </div>
        <div>
          <label htmlFor={`${id}-emp`} className={label}>{t("hire.fEmployment")}</label>
          <select id={`${id}-emp`} name="employment" defaultValue="full_time" className={`${field} mt-2 h-12 sm:mt-[1.85rem]`}>
            {EMPLOYMENT.map((e) => (
              <option key={e} value={e}>
                {t(`hire.e${e[0].toUpperCase()}${e.slice(1)}` as MessageKey)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor={`${id}-desc`} className={label}>{t("hire.fDescription")}</label>
        <p id={`${id}-desc-h`} className={hint}>{t("hire.fDescriptionHint")}</p>
        <textarea
          id={`${id}-desc`}
          name="description"
          required
          minLength={200}
          maxLength={20000}
          rows={12}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-describedby={`${id}-desc-h ${id}-desc-n`}
          className={`${field} mt-2 resize-y py-3 leading-relaxed`}
        />
        <p id={`${id}-desc-n`} className="mt-1 text-end text-xs text-muted tabular-nums">{description.length} / 20000</p>
      </div>

      <div>
        <label htmlFor={`${id}-skills`} className={label}>{t("hire.fSkills")}</label>
        <p id={`${id}-skills-h`} className={hint}>{t("hire.fSkillsHint")}</p>
        <input id={`${id}-skills`} name="skills" maxLength={400} aria-describedby={`${id}-skills-h`} className={`${field} mt-2 h-12`} />
      </div>

      <fieldset>
        <legend className={label}>{t("hire.fPay")}</legend>
        <p className={hint}>{t("hire.fPayHint")}</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-sm">
            {t("hire.fMin")}
            <input name="salaryMin" inputMode="numeric" className={`${field} mt-1 h-12`} />
          </label>
          <label className="text-sm">
            {t("hire.fMax")}
            <input name="salaryMax" inputMode="numeric" className={`${field} mt-1 h-12`} />
          </label>
          <label className="text-sm">
            {t("hire.fCurrency")}
            <input name="currency" maxLength={3} placeholder="USD" className={`${field} mt-1 h-12 uppercase`} />
          </label>
          <label className="text-sm">
            {t("hire.fPeriod")}
            <select name="period" defaultValue="year" className={`${field} mt-1 h-12`}>
              <option value="year">{t("hire.pYear")}</option>
              <option value="month">{t("hire.pMonth")}</option>
              <option value="hour">{t("hire.pHour")}</option>
            </select>
          </label>
        </div>
      </fieldset>

      <label className="inline-flex min-h-11 cursor-pointer items-center gap-3">
        <input type="checkbox" name="visa" className="size-5 accent-[var(--color-ink)]" />
        {t("hire.fVisa")}
      </label>

      <fieldset>
        <legend className={label}>{t("hire.fQuestions")}</legend>
        <p className={hint}>{t("hire.fQuestionsHint")}</p>
        <ul className="mt-3 flex flex-col gap-3">
          {questions.map((q, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface p-3">
              <div className="flex items-start gap-2">
                <label className="sr-only" htmlFor={`${id}-q${i}`}>{t("hire.fQuestions")} {i + 1}</label>
                <input
                  id={`${id}-q${i}`}
                  value={q.q}
                  maxLength={200}
                  placeholder={t("hire.qPlaceholder")}
                  onChange={(e) => setQuestions((list) => list.map((x, j) => (j === i ? { ...x, q: e.target.value } : x)))}
                  className={`${field} h-11`}
                />
                <button
                  type="button"
                  onClick={() => setQuestions((list) => list.filter((_, j) => j !== i))}
                  aria-label={t("hire.removeQuestion")}
                  className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-ink-soft"
                >
                  <X aria-hidden="true" className="size-4" />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
                <select
                  aria-label={t("hire.fQuestions")}
                  value={q.kind}
                  onChange={(e) => setQuestions((list) => list.map((x, j) => (j === i ? { ...x, kind: e.target.value as Question["kind"] } : x)))}
                  className="h-10 rounded-lg border border-line bg-surface px-2"
                >
                  <option value="yesno">{t("hire.qYesNo")}</option>
                  <option value="text">{t("hire.qText")}</option>
                </select>
                <label className="inline-flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => setQuestions((list) => list.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))}
                    className="size-4"
                  />
                  {t("hire.qRequired")}
                </label>
              </div>
            </li>
          ))}
        </ul>
        {questions.length < 5 && (
          <button
            type="button"
            onClick={() => setQuestions((list) => [...list, { q: "", kind: "yesno", required: true }])}
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 hover:border-ink"
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("hire.addQuestion")}
          </button>
        )}
      </fieldset>

      <p id={`${id}-note`} className="flex items-start gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal-ink" />
        {t("hire.reviewNote")}
      </p>

      {status && (
        <div role="alert" className={`rounded-xl border p-4 ${status.kind === "rejected" ? "border-[#b4532a]/50 bg-[#b4532a]/5" : "border-line bg-ink-soft"}`}>
          {status.kind === "rejected" && <p className="font-medium">{t("hire.rejectedTitle")}</p>}
          <p>{status.text}</p>
        </div>
      )}

      <div>
        <button
          type="submit"
          disabled={pending || !enabled}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? t("hire.submitting") : t("hire.submit")}
        </button>
        {!enabled && <p className="mt-2 text-sm text-muted">{t("hire.errReviewOff")}</p>}
      </div>
    </form>
  );
}
