"use client";

import { Plus, X } from "lucide-react";
import { useId } from "react";
import { MAX_CUSTOM, MAX_OPTIONS, STD_FIELDS, type CustomKind, type FieldMode, type FormConfig } from "@/lib/application-form";

const field =
  "w-full rounded-xl border border-line bg-surface px-4 outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]";
const MODES: [FieldMode, string][] = [
  ["required", "Required"],
  ["optional", "Optional"],
  ["off", "Off"],
];
const KINDS: [CustomKind, string][] = [
  ["yesno", "Yes / No"],
  ["choice", "Multiple choice"],
  ["text", "Short answer"],
  ["longtext", "Paragraph"],
];
const STEPS = [
  ["info", "My information"],
  ["experience", "My experience"],
  ["questions", "Application questions"],
] as const;

/** The employer's side of the application form: what applicants fill in when they apply on Rolearch. */
export function ApplicationFormSetup({ value, onChange }: { value: FormConfig; onChange: (f: FormConfig) => void }) {
  const id = useId();
  const setMode = (k: keyof FormConfig["modes"], m: FieldMode) => onChange({ ...value, modes: { ...value.modes, [k]: m } });
  const setQ = (i: number, patch: Partial<FormConfig["custom"][number]>) =>
    onChange({ ...value, custom: value.custom.map((q, j) => (j === i ? { ...q, ...patch } : q)) });

  return (
    <fieldset>
      <legend className="block font-medium">Application form</legend>
      <p className="mt-1 text-sm text-muted">
        What people fill in when they apply on Rolearch. Name, email and résumé are always included, taken from their profile. Choose which other fields to ask for, then add your own questions.
      </p>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface">
        {STEPS.map(([step, title]) => (
          <div key={step} className="border-b border-line last:border-b-0">
            <p className="bg-ink-soft px-4 py-2 text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
            <ul className="divide-y divide-line">
              {STD_FIELDS.filter((f) => f.step === step).map((f) => (
                <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                  <span className={`min-w-0 flex-1 text-sm ${value.modes[f.id] === "off" ? "text-muted line-through decoration-1" : ""}`}>{f.label}</span>
                  <div role="radiogroup" aria-label={f.label} className="inline-flex rounded-full border border-line p-0.5">
                    {MODES.map(([m, label]) => (
                      <label
                        key={m}
                        className={`cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
                          value.modes[f.id] === m ? "bg-ink text-paper" : "text-muted hover:text-ink"
                        }`}
                      >
                        <input type="radio" name={`${id}-${f.id}`} value={m} checked={value.modes[f.id] === m} onChange={() => setMode(f.id, m)} className="sr-only" />
                        {label}
                      </label>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="mt-6 font-medium">Your questions</p>
      <p className="mt-1 text-sm text-muted">Up to {MAX_CUSTOM}. Shown on the &ldquo;Application questions&rdquo; step, after the fields above.</p>
      <ul className="mt-3 flex flex-col gap-3">
        {value.custom.map((q, i) => (
          <li key={i} className="rounded-xl border border-line bg-surface p-3">
            <div className="flex items-start gap-2">
              <label className="sr-only" htmlFor={`${id}-q${i}`}>
                Question {i + 1}
              </label>
              <input
                id={`${id}-q${i}`}
                value={q.q}
                maxLength={200}
                placeholder="e.g. Do you have a valid driver's license?"
                onChange={(e) => setQ(i, { q: e.target.value })}
                className={`${field} h-11`}
              />
              <button
                type="button"
                onClick={() => onChange({ ...value, custom: value.custom.filter((_, j) => j !== i) })}
                aria-label={`Remove question ${i + 1}`}
                className="grid size-11 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-ink-soft"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm">
              <select
                aria-label={`Answer type for question ${i + 1}`}
                value={q.kind}
                onChange={(e) => {
                  const kind = e.target.value as CustomKind;
                  setQ(i, { kind, options: kind === "choice" ? (q.options?.length ? q.options : ["", ""]) : undefined });
                }}
                className="h-10 rounded-lg border border-line bg-surface px-2"
              >
                {KINDS.map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={q.required} onChange={(e) => setQ(i, { required: e.target.checked })} className="size-4" />
                Required
              </label>
            </div>
            {q.kind === "choice" && (
              <div className="mt-3 flex flex-col gap-2 border-s-2 border-line ps-3">
                {(q.options ?? []).map((o, k) => (
                  <div key={k} className="flex items-center gap-2">
                    <input
                      value={o}
                      maxLength={100}
                      aria-label={`Option ${k + 1}`}
                      placeholder={`Option ${k + 1}`}
                      onChange={(e) => setQ(i, { options: (q.options ?? []).map((x, n) => (n === k ? e.target.value : x)) })}
                      className={`${field} h-10 text-sm`}
                    />
                    {(q.options?.length ?? 0) > 2 && (
                      <button
                        type="button"
                        onClick={() => setQ(i, { options: (q.options ?? []).filter((_, n) => n !== k) })}
                        aria-label={`Remove option ${k + 1}`}
                        className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-ink-soft"
                      >
                        <X aria-hidden="true" className="size-4" />
                      </button>
                    )}
                  </div>
                ))}
                {(q.options?.length ?? 0) < MAX_OPTIONS && (
                  <button type="button" onClick={() => setQ(i, { options: [...(q.options ?? []), ""] })} className="self-start text-sm underline underline-offset-4">
                    Add option
                  </button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
      {value.custom.length < MAX_CUSTOM && (
        <button
          type="button"
          onClick={() => onChange({ ...value, custom: [...value.custom, { q: "", kind: "yesno", required: true }] })}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-line px-4 hover:border-ink"
        >
          <Plus aria-hidden="true" className="size-4" />
          Add a question
        </button>
      )}
    </fieldset>
  );
}
