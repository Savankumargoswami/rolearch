"use client";

import { ArrowUpRight, MessageSquare, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import { TRACKER_STATUSES, type TrackedJob, type TrackerStatus } from "@/lib/tracker";
import { withdrawApplication } from "../jobs/[id]/apply/actions";
import { untrackJob, updateTracked } from "./actions";

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

/** One tracked job: its status, notes and, for Rolearch applications, the company's status and messages. */
export function TrackerItem({
  job,
  application,
  messages,
}: {
  job: TrackedJob;
  application: { id: string; stage: string } | null;
  messages: { body: string; at: string }[];
}) {
  const id = useId();
  const router = useRouter();
  const [notes, setNotes] = useState(job.notes);
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

      <details className="mt-3 group">
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
