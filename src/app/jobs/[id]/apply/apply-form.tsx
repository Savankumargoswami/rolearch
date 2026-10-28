"use client";

import { Check, CircleCheck, Pencil } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { t } from "@/i18n";
import { SOURCES, STD_FIELDS, type ApplicationInput, type CustomQuestion, type FormConfig, type StdField } from "@/lib/application-form";
import { applyToJob } from "./actions";

export type ResumeSummary = { roles: string[]; schools: string[]; skills: string[] };
type Prefill = { firstName: string; lastName: string; phone: string; location: string; linkedin: string; website: string };

const STEPS = ["My information", "My experience", "Application questions", "Review and submit"] as const;
const field = "mt-1.5 w-full rounded-xl border border-line bg-surface px-4 outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]";

/** A Workday-style application: four steps, prefilled from the Rolearch profile, checked before moving on. */
export function ApplyForm({ jobId, company, form, prefill, resume }: { jobId: string; company: string; form: FormConfig; prefill: Prefill; resume: ResumeSummary }) {
  const id = useId();
  const [step, setStep] = useState(0);
  const [v, setV] = useState<ApplicationInput>({ ...prefill, coverLetter: "", std: {}, custom: {}, attest: false });
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const on = (f: StdField) => form.modes[f.id] !== "off";
  const req = (f: StdField) => form.modes[f.id] === "required";
  const stdQuestions = STD_FIELDS.filter((f) => f.step === "questions" && on(f));
  const hasQuestions = stdQuestions.length + form.custom.length > 0;
  const set = (patch: Partial<ApplicationInput>) => setV((x) => ({ ...x, ...patch }));
  const contactValue = (f: StdField) => (f.id === "phone" ? v.phone : f.id === "location" ? v.location : f.id === "linkedin" ? v.linkedin : f.id === "website" ? v.website : "");

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

  /** The first missing required answer on a step, or "". */
  function missing(s: number): string {
    if (s === 0) {
      if (!v.firstName.trim()) return "First name";
      if (!v.lastName.trim()) return "Last name";
      const f = STD_FIELDS.find((x) => x.step === "info" && req(x) && !contactValue(x).trim());
      return f ? f.label : "";
    }
    if (s === 1) return form.modes.coverLetter === "required" && !v.coverLetter.trim() ? "Cover letter" : "";
    if (s === 2) {
      const f = stdQuestions.find((x) => req(x) && !(v.std[x.id] ?? "").trim());
      if (f) return f.label;
      const q = form.custom.find((x) => x.required && !(v.custom[x.q] ?? "").trim());
      return q ? q.q : "";
    }
    return v.attest ? "" : "Please confirm the information is accurate";
  }
  const order = [0, 1, ...(hasQuestions ? [2] : []), 3];
  const pos = order.indexOf(step);
  const next = () => {
    const m = missing(step);
    if (m) return setError(step === 3 ? m : `Please answer: ${m}`);
    setError("");
    setStep(order[pos + 1]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    setError("");
    setStep(order[pos - 1]);
  };
  const submit = () => {
    const m = order.map(missing).find(Boolean);
    if (m) return setError(m.startsWith("Please") ? m : `Please answer: ${m}`);
    setError("");
    start(async () => {
      const res = await applyToJob(jobId, v);
      if (res.ok) setDone(true);
      else setError(res.message);
    });
  };

  return (
    <div className="mt-6">
      <ol className="grid gap-2" style={{ gridTemplateColumns: `repeat(${order.length}, minmax(0, 1fr))` }} aria-label="Application steps">
        {order.map((s, i) => (
          <li key={s} aria-current={s === step ? "step" : undefined}>
            <div className={`h-1.5 rounded-full ${i <= pos ? "bg-ink" : "bg-ink-soft"}`} />
            <p className={`mt-2 hidden text-xs sm:block ${s === step ? "font-semibold" : "text-muted"}`}>{STEPS[s]}</p>
          </li>
        ))}
      </ol>
      <h2 className="mt-5 font-display text-2xl font-semibold">{STEPS[step]}</h2>

      <div className="mt-4 rounded-2xl border border-line bg-surface p-5">
        {step === 0 && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Text label="First name" required value={v.firstName} onChange={(x) => set({ firstName: x })} id={`${id}-fn`} autoComplete="given-name" />
            <Text label="Last name" required value={v.lastName} onChange={(x) => set({ lastName: x })} id={`${id}-ln`} autoComplete="family-name" />
            {STD_FIELDS.filter((f) => f.step === "info" && on(f)).map((f) => (
              <Text
                key={f.id}
                id={`${id}-${f.id}`}
                label={f.label}
                required={req(f)}
                type={f.input === "tel" ? "tel" : f.input === "url" ? "url" : "text"}
                autoComplete={f.id === "phone" ? "tel" : f.id === "location" ? "address-level2" : "url"}
                value={contactValue(f)}
                onChange={(x) => set(f.id === "phone" ? { phone: x } : f.id === "location" ? { location: x } : f.id === "linkedin" ? { linkedin: x } : { website: x })}
              />
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-semibold">Résumé (from your Rolearch profile)</p>
                <Link href="/account/profile" className="inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
                  <Pencil aria-hidden="true" className="size-3.5" /> Edit profile
                </Link>
              </div>
              <ResumeBlock resume={resume} />
            </div>
            {form.modes.coverLetter !== "off" && (
              <div>
                <label htmlFor={`${id}-cl`} className="font-medium">
                  Cover letter {form.modes.coverLetter === "required" ? <Req /> : <Opt />}
                </label>
                <textarea id={`${id}-cl`} rows={8} maxLength={6000} value={v.coverLetter} onChange={(e) => set({ coverLetter: e.target.value })} placeholder={`Why you, and why ${company}?`} className={`${field} resize-y py-3 leading-relaxed`} />
              </div>
            )}
          </div>
        )}

        {step === 2 && (
          <ol className="flex flex-col gap-5">
            {stdQuestions.map((f) => (
              <li key={f.id}>
                <StdInput f={f} required={req(f)} value={v.std[f.id] ?? ""} onChange={(x) => set({ std: { ...v.std, [f.id]: x } })} id={`${id}-${f.id}`} />
              </li>
            ))}
            {form.custom.map((q, i) => (
              <li key={q.q}>
                <CustomInput q={q} value={v.custom[q.q] ?? ""} onChange={(x) => set({ custom: { ...v.custom, [q.q]: x } })} id={`${id}-c${i}`} />
              </li>
            ))}
          </ol>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5 text-sm">
            <Review title="My information" onEdit={() => setStep(0)}>
              <Line k="Name" v={`${v.firstName} ${v.lastName}`} />
              {STD_FIELDS.filter((f) => f.step === "info" && on(f)).map((f) => (
                <Line key={f.id} k={f.label} v={contactValue(f)} />
              ))}
            </Review>
            <Review title="My experience" onEdit={() => setStep(1)}>
              <Line k="Résumé" v={`${resume.roles.length} roles · ${resume.schools.length} schools · ${resume.skills.length} skills`} />
              {form.modes.coverLetter !== "off" && <Line k="Cover letter" v={v.coverLetter ? `${v.coverLetter.slice(0, 140)}${v.coverLetter.length > 140 ? "…" : ""}` : ""} />}
            </Review>
            {hasQuestions && (
              <Review title="Application questions" onEdit={() => setStep(2)}>
                {stdQuestions.map((f) => (
                  <Line key={f.id} k={f.label} v={v.std[f.id] === "yes" ? "Yes" : v.std[f.id] === "no" ? "No" : v.std[f.id] ?? ""} />
                ))}
                {form.custom.map((q) => (
                  <Line key={q.q} k={q.q} v={v.custom[q.q] === "yes" ? "Yes" : v.custom[q.q] === "no" ? "No" : v.custom[q.q] ?? ""} />
                ))}
              </Review>
            )}
            <label className="flex items-start gap-3 rounded-xl bg-ink-soft p-4 text-[0.95rem]">
              <input type="checkbox" checked={v.attest} onChange={(e) => set({ attest: e.target.checked })} className="mt-1 size-5 shrink-0 accent-[var(--color-ink)]" />
              <span>I confirm the information in this application is true and complete. {company} receives it with my Rolearch résumé.</span>
            </label>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-xl border border-[#b4532a]/50 bg-[#b4532a]/5 p-4">
          {error}
        </p>
      )}

      <div className="mt-5 flex justify-between gap-3">
        <button type="button" onClick={back} disabled={pos === 0} className="min-h-12 cursor-pointer rounded-full border border-line px-6 font-medium hover:border-ink disabled:invisible">
          Back
        </button>
        {step === 3 ? (
          <button type="button" onClick={submit} disabled={pending} className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-ink px-6 font-medium text-paper hover:bg-ink-hover disabled:opacity-60">
            <Check aria-hidden="true" className="size-4" />
            {pending ? t("apply.sending") : t("apply.submit")}
          </button>
        ) : (
          <button type="button" onClick={next} className="min-h-12 cursor-pointer rounded-full bg-ink px-6 font-medium text-paper hover:bg-ink-hover">
            Save and continue
          </button>
        )}
      </div>
    </div>
  );
}

const Req = () => <span className="text-sm font-normal text-[#b4532a]">*</span>;
const Opt = () => <span className="text-sm font-normal text-muted">(optional)</span>;

function Text({ id, label, value, onChange, required = false, type = "text", autoComplete }: { id: string; label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; autoComplete?: string }) {
  return (
    <div>
      <label htmlFor={id} className="font-medium">
        {label} {required ? <Req /> : <Opt />}
      </label>
      <input id={id} type={type} value={value} required={required} autoComplete={autoComplete} maxLength={300} onChange={(e) => onChange(e.target.value)} className={`${field} h-12`} />
    </div>
  );
}

function YesNo({ id, value, onChange }: { id: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mt-2 flex gap-2">
      {(["yes", "no"] as const).map((x) => (
        <label key={x} className={`inline-flex min-h-11 cursor-pointer items-center rounded-full border px-5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${value === x ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}>
          <input type="radio" name={id} value={x} checked={value === x} onChange={() => onChange(x)} className="sr-only" />
          {x === "yes" ? t("apply.yes") : t("apply.no")}
        </label>
      ))}
    </div>
  );
}

function StdInput({ f, id, required, value, onChange }: { f: StdField; id: string; required: boolean; value: string; onChange: (v: string) => void }) {
  if (f.input === "yesno")
    return (
      <fieldset>
        <legend className="font-medium">
          {f.label} {required ? <Req /> : <Opt />}
        </legend>
        <YesNo id={id} value={value} onChange={onChange} />
      </fieldset>
    );
  return (
    <div>
      <label htmlFor={id} className="font-medium">
        {f.label} {required ? <Req /> : <Opt />}
      </label>
      {f.input === "source" ? (
        <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} h-12`}>
          <option value="">Select one</option>
          {SOURCES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      ) : (
        <input id={id} type={f.input === "date" ? "date" : "text"} value={value} maxLength={120} placeholder={f.id === "pay" ? "e.g. $95,000 a year or $28 an hour" : undefined} onChange={(e) => onChange(e.target.value)} className={`${field} h-12`} />
      )}
    </div>
  );
}

function CustomInput({ q, id, value, onChange }: { q: CustomQuestion; id: string; value: string; onChange: (v: string) => void }) {
  const head = (
    <>
      {q.q} {q.required ? <Req /> : <Opt />}
    </>
  );
  if (q.kind === "yesno")
    return (
      <fieldset>
        <legend className="font-medium">{head}</legend>
        <YesNo id={id} value={value} onChange={onChange} />
      </fieldset>
    );
  if (q.kind === "choice")
    return (
      <fieldset>
        <legend className="font-medium">{head}</legend>
        <div className="mt-2 flex flex-col gap-2">
          {(q.options ?? []).map((o) => (
            <label key={o} className="inline-flex min-h-10 cursor-pointer items-center gap-3">
              <input type="radio" name={id} checked={value === o} onChange={() => onChange(o)} className="size-4 accent-[var(--color-ink)]" />
              {o}
            </label>
          ))}
        </div>
      </fieldset>
    );
  return (
    <div>
      <label htmlFor={id} className="font-medium">
        {head}
      </label>
      {q.kind === "longtext" ? (
        <textarea id={id} rows={5} maxLength={4000} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} resize-y py-3`} />
      ) : (
        <input id={id} maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} className={`${field} h-12`} />
      )}
    </div>
  );
}

function ResumeBlock({ resume }: { resume: ResumeSummary }) {
  return (
    <div className="mt-2 grid gap-3 rounded-xl bg-ink-soft p-4 text-sm sm:grid-cols-3">
      <div>
        <p className="font-medium">Experience</p>
        <ul className="mt-1 text-muted">
          {resume.roles.slice(0, 4).map((r) => (
            <li key={r} className="truncate">
              {r}
            </li>
          ))}
          {resume.roles.length === 0 && <li>None listed</li>}
        </ul>
      </div>
      <div>
        <p className="font-medium">Education</p>
        <ul className="mt-1 text-muted">
          {resume.schools.slice(0, 3).map((s) => (
            <li key={s} className="truncate">
              {s}
            </li>
          ))}
          {resume.schools.length === 0 && <li>None listed</li>}
        </ul>
      </div>
      <div>
        <p className="font-medium">Skills</p>
        <p className="mt-1 text-muted">{resume.skills.slice(0, 10).join(", ") || "None listed"}</p>
      </div>
    </div>
  );
}

function Review({ title, onEdit, children }: { title: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <section>
      <div className="flex items-baseline justify-between gap-2 border-b border-line pb-1">
        <h3 className="font-semibold">{title}</h3>
        <button type="button" onClick={onEdit} className="min-h-9 cursor-pointer text-sm font-medium underline underline-offset-4">
          Edit
        </button>
      </div>
      <dl className="mt-2 flex flex-col gap-1.5">{children}</dl>
    </section>
  );
}

function Line({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[16rem_1fr] sm:gap-4">
      <dt className="text-muted">{k}</dt>
      <dd className="min-w-0 break-words">{v || <span className="text-muted">Not answered</span>}</dd>
    </div>
  );
}
