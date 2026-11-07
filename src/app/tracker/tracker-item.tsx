"use client";

import { ArrowRight, ArrowUpRight, CalendarClock, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import { LOG_KINDS, REJECTION_REASONS, TRACKER_STATUSES, type NextStep, type TrackedJob, type TrackerStatus } from "@/lib/tracker";
import { withdrawApplication } from "../jobs/[id]/apply/actions";
import { addLogEntry, untrackJob, updateManager, updateTracked } from "./actions";

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** One tracked job: its status, notes and, for Rolearch applications, the company's status and messages. */
export function TrackerItem({
  job,
  application,
  messages,
  step,
}: {
  job: TrackedJob;
  application: { id: string; stage: string } | null;
  messages: { body: string; at: string }[];
  step: NextStep | null;
}) {
  const id = useId();
  const router = useRouter();
  const [notes, setNotes] = useState(job.notes);
  const [form, setForm] = useState({
    deadline: job.deadline ?? "",
    interviewAt: job.interviewAt ? toLocal(job.interviewAt) : "",
    followUpOn: job.followUpOn ?? "",
    contactName: job.contactName,
    contactEmail: job.contactEmail,
    rejectionReason: job.rejectionReason as string,
  });
  const [entry, setEntry] = useState({ kind: "email", text: "" });
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const external = /^https?:/.test(job.url);
  const live = application && application.stage !== "withdrawn";

  function run(fn: () => Promise<{ ok: boolean; message?: string }>) {
    setError("");
    start(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.message ?? t("tracker.errSave"));
    });
  }

  return (
    <article className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium">
            {external ? (
              <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:underline">
                {job.title}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            ) : (
              <Link href={job.url || `/jobs/${job.jobId}`} className="hover:underline">{job.title}</Link>
            )}
          </h3>
          <p className="text-sm text-muted">
            {job.company} ·{" "}
            {job.appliedAt ? t("tracker.appliedOn", { date: date.format(new Date(job.appliedAt)) }) : t("tracker.savedOn", { date: date.format(new Date(job.createdAt)) })}
          </p>
          {application && (
            <p className="mt-1 text-sm">
              <span className="rounded-full bg-signal/25 px-2 py-0.5 text-xs font-medium">{t("tracker.viaRolearch")}</span>{" "}
              {t("tracker.companyStage", { stage: t(`hire.st_${application.stage}` as MessageKey) })}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={`${id}-s`} className="sr-only">{t("tracker.status")}</label>
          <select
            id={`${id}-s`}
            value={job.status}
            disabled={pending || Boolean(live)}
            onChange={(e) => run(() => updateTracked(job.jobId, { status: e.target.value as TrackerStatus }))}
            className="h-10 rounded-lg border border-line bg-surface px-2 text-sm disabled:opacity-60"
            title={live ? t("tracker.viaRolearch") : undefined}
          >
            {TRACKER_STATUSES.map((s) => (
              <option key={s} value={s}>{t(`tracker.s_${s}` as MessageKey)}</option>
            ))}
          </select>
          {!application && (
            <button
              type="button"
              onClick={() => run(() => untrackJob(job.jobId))}
              disabled={pending}
              aria-label={t("tracker.remove")}
              className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-ink-soft"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </button>
          )}
        </div>
      </div>

      {step && (
        <p className={`mt-3 flex items-start gap-2 rounded-xl px-3 py-2 text-sm ${step.urgent ? "bg-signal/20" : "bg-ink-soft/70"}`}>
          <CalendarClock aria-hidden="true" className={`mt-0.5 size-4 shrink-0 ${step.urgent ? "text-signal-ink" : "text-muted"}`} />
          <span>
            <span className="font-semibold">{t("tracker.next")}: </span>
            {step.href ? (
              <Link href={step.href} className="inline-flex items-center gap-1 underline underline-offset-4">
                {t(`tracker.next_${step.id}` as MessageKey, step.values)}
                <ArrowRight aria-hidden="true" className="size-3.5" />
              </Link>
            ) : (
              t(`tracker.next_${step.id}` as MessageKey, step.values)
            )}
          </span>
        </p>
      )}

      {messages.length > 0 && (
        <section aria-label={t("tracker.messagesTitle", { company: job.company })} className="mt-3 rounded-xl bg-ink-soft/60 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <MessageSquare aria-hidden="true" className="size-4" />
            {t("tracker.messagesTitle", { company: job.company })}
          </p>
          <ol className="mt-2 flex flex-col gap-2">
            {messages.map((m, i) => (
              <li key={i} className="text-sm">
                <p className="whitespace-pre-line">{m.body}</p>
                <p className="text-xs text-muted">{date.format(new Date(m.at))}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      <details className="mt-3">
        <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
          {t("tracker.details")}
          {job.contactName ? <span className="ms-1 font-normal text-muted no-underline">· {job.contactName}</span> : null}
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label={t("tracker.deadline")}>
            <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t("tracker.interviewAt")}>
            <input type="datetime-local" value={form.interviewAt} onChange={(e) => setForm({ ...form, interviewAt: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t("tracker.followUpOn")}>
            <input type="date" value={form.followUpOn} onChange={(e) => setForm({ ...form, followUpOn: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t("tracker.rejectionReason")}>
            <select value={form.rejectionReason} onChange={(e) => setForm({ ...form, rejectionReason: e.target.value })} className={inputClass}>
              {["", ...REJECTION_REASONS].map((r) => (
                <option key={r} value={r}>
                  {t(`tracker.reason_${r}` as MessageKey)}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t("tracker.contactName")}>
            <input value={form.contactName} maxLength={120} onChange={(e) => setForm({ ...form, contactName: e.target.value })} className={inputClass} />
          </Field>
          <Field label={t("tracker.contactEmail")}>
            <input type="email" value={form.contactEmail} maxLength={200} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} className={inputClass} />
          </Field>
        </div>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() =>
              updateManager(job.jobId, {
                deadline: form.deadline || null,
                interviewAt: form.interviewAt ? new Date(form.interviewAt).toISOString() : null,
                followUpOn: form.followUpOn || null,
                contactName: form.contactName,
                contactEmail: form.contactEmail,
                rejectionReason: form.rejectionReason,
              }),
            )
          }
          className="mt-3 inline-flex min-h-10 cursor-pointer items-center rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover disabled:opacity-50"
        >
          {t("tracker.saveDetails")}
        </button>

        <div className="mt-4 rounded-xl bg-ink-soft/50 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            <MessageSquare aria-hidden="true" className="size-4" />
            {t("tracker.logTitle")}
          </p>
          {job.log.length ? (
            <ol className="mt-2 flex flex-col gap-2">
              {job.log.map((e, i) => (
                <li key={i} className="text-sm">
                  <span className="me-1.5 rounded-full bg-surface px-2 py-0.5 text-xs font-medium">{t(`tracker.log_${e.kind}` as MessageKey)}</span>
                  <span className="whitespace-pre-line">
                    {e.kind === "status"
                      ? t("tracker.statusChange", {
                          from: t(`tracker.s_${e.text.split("→")[0]}` as MessageKey),
                          to: t(`tracker.s_${e.text.split("→")[1]}` as MessageKey),
                        })
                      : e.text}
                  </span>
                  <span className="block text-xs text-muted">{date.format(new Date(e.at))}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-1 text-sm text-muted">{t("tracker.logEmpty")}</p>
          )}
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <label className="sr-only" htmlFor={`${id}-lk`}>
              {t("tracker.logTitle")}
            </label>
            <select id={`${id}-lk`} value={entry.kind} onChange={(e) => setEntry({ ...entry, kind: e.target.value })} className={`${inputClass} sm:w-32`}>
              {LOG_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`tracker.log_${k}` as MessageKey)}
                </option>
              ))}
            </select>
            <label className="sr-only" htmlFor={`${id}-lt`}>
              {t("tracker.logPlaceholder")}
            </label>
            <input
              id={`${id}-lt`}
              value={entry.text}
              maxLength={1000}
              placeholder={t("tracker.logPlaceholder")}
              onChange={(e) => setEntry({ ...entry, text: e.target.value })}
              className={`${inputClass} flex-1`}
            />
            <button
              type="button"
              disabled={pending || !entry.text.trim()}
              onClick={() =>
                run(async () => {
                  const r = await addLogEntry(job.jobId, entry);
                  if (r.ok) setEntry({ ...entry, text: "" });
                  return r;
                })
              }
              className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink-soft disabled:opacity-50"
            >
              {t("tracker.logAdd")}
            </button>
          </div>
        </div>
      </details>

      {job.coverLetter && (
        <details className="mt-1">
          <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
            {t("tracker.coverLetter")}
          </summary>
          <p className="mt-2 rounded-xl bg-ink-soft/50 p-3 text-sm whitespace-pre-line">{job.coverLetter}</p>
        </details>
      )}

      <details className="mt-1 group">
        <summary className="inline-flex min-h-10 cursor-pointer items-center text-sm font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
          {t("tracker.notes")}{job.notes ? " ·" : ""} {job.notes ? <span className="ms-1 max-w-[30ch] truncate font-normal text-muted no-underline">{job.notes}</span> : null}
        </summary>
        <label htmlFor={`${id}-n`} className="sr-only">{t("tracker.notes")}</label>
        <textarea
          id={`${id}-n`}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          maxLength={4000}
          placeholder={t("tracker.notesPlaceholder")}
          className="mt-2 w-full resize-y rounded-xl border border-line bg-paper/40 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending || notes === job.notes}
          onClick={() => run(() => updateTracked(job.jobId, { notes }))}
          className="mt-2 inline-flex min-h-10 cursor-pointer items-center rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t("tracker.saveNotes")}
        </button>
      </details>

      {live && (
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (window.confirm(t("tracker.withdraw") + "?")) run(() => withdrawApplication(application.id));
          }}
          className="mt-3 inline-flex min-h-10 cursor-pointer items-center text-sm text-[#b4532a] underline underline-offset-4"
        >
          {t("tracker.withdraw")}
        </button>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-[#b4532a]">{error}</p>}
    </article>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-line bg-surface px-2 text-sm";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted">{label}</span>
      {children}
    </label>
  );
}

/** An ISO time as the value a datetime-local input expects, in the viewer's own time zone. */
function toLocal(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
