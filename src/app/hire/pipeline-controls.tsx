"use client";

import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { t, type MessageKey } from "@/i18n";
import { addApplicantEvent, moveApplicant, setJobStatus } from "./actions";

const STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"] as const;

/** Moves an applicant to another stage, optionally with a message the applicant sees in their tracker. */
export function StageMenu({ appId, stage, compact = false }: { appId: string; stage: string; compact?: boolean }) {
  const id = useId();
  const router = useRouter();
  const [next, setNext] = useState(stage);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function apply(to: string, msg = "") {
    setError("");
    start(async () => {
      const res = await moveApplicant(appId, to, msg);
      if (res.ok) {
        setMessage("");
        router.refresh();
      } else setError(res.message);
    });
  }

  if (compact) {
    return (
      <div className="mt-2">
        <label htmlFor={`${id}-s`} className="sr-only">{t("hire.moveTo")}</label>
        <select
          id={`${id}-s`}
          value={stage}
          disabled={pending}
          onChange={(e) => apply(e.target.value)}
          className="h-9 w-full rounded-lg border border-line bg-surface px-2 text-sm disabled:opacity-60"
        >
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {t("hire.moveTo")}: {t(`hire.st_${s}` as MessageKey)}
            </option>
          ))}
        </select>
        {error && <p role="alert" className="mt-1 text-xs text-[#b4532a]">{error}</p>}
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        apply(next, message);
      }}
      className="flex flex-col gap-3"
    >
      <label htmlFor={`${id}-s`} className="text-sm font-medium">{t("hire.moveTo")}</label>
      <select id={`${id}-s`} value={next} onChange={(e) => setNext(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-3">
        {STAGES.map((s) => (
          <option key={s} value={s}>{t(`hire.st_${s}` as MessageKey)}</option>
        ))}
      </select>
      <label htmlFor={`${id}-m`} className="text-sm">{t("hire.stageMessage")}</label>
      <textarea
        id={`${id}-m`}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={t("hire.messagePlaceholder")}
        className="resize-y rounded-xl border border-line bg-surface px-3 py-2"
      />
      <button
        type="submit"
        disabled={pending || (next === stage && !message.trim())}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {t("hire.save")}
      </button>
      {error && <p role="alert" className="text-sm text-[#b4532a]">{error}</p>}
    </form>
  );
}

/** Close or reopen a job. */
export function JobStatusButton({ jobId, status }: { jobId: string; status: "open" | "closed" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        title={status === "open" ? t("hire.closeConfirm") : undefined}
        onClick={() => {
          if (status === "open" && !window.confirm(t("hire.closeConfirm"))) return;
          start(async () => {
            const res = await setJobStatus(jobId, status === "open" ? "closed" : "open");
            if (res.ok) router.refresh();
            else setError(res.message);
          });
        }}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink px-4 font-medium hover:bg-ink-soft disabled:opacity-60"
      >
        {status === "open" ? t("hire.closeJob") : t("hire.reopenJob")}
      </button>
      {error && <p role="alert" className="mt-1 text-sm text-[#b4532a]">{error}</p>}
    </div>
  );
}

/** A private note for the team, or a message the applicant sees. */
export function EventComposer({ appId }: { appId: string }) {
  const id = useId();
  const router = useRouter();
  const [kind, setKind] = useState<"note" | "message">("note");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await addApplicantEvent(appId, kind, body);
          if (res.ok) {
            setBody("");
            router.refresh();
          } else setError(res.message);
        });
      }}
      className="flex flex-col gap-3"
    >
      <div role="radiogroup" aria-label={t("hire.historyTitle")} className="flex gap-2">
        {(["note", "message"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`min-h-10 cursor-pointer rounded-full border px-4 text-sm ${kind === k ? "border-ink bg-ink text-paper" : "border-line hover:border-ink"}`}
          >
            {k === "note" ? t("hire.writeNote") : t("hire.writeMessage")}
          </button>
        ))}
      </div>
      <label htmlFor={`${id}-b`} className="sr-only">{kind === "note" ? t("hire.writeNote") : t("hire.writeMessage")}</label>
      <textarea
        id={`${id}-b`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={3}
        maxLength={4000}
        placeholder={kind === "note" ? t("hire.notePlaceholder") : t("hire.messagePlaceholder")}
        className="resize-y rounded-xl border border-line bg-surface px-3 py-2"
      />
      <button
        type="submit"
        disabled={pending || !body.trim()}
        className="inline-flex min-h-11 cursor-pointer items-center justify-center self-start rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {kind === "note" ? t("hire.save") : t("hire.send")}
      </button>
      {error && <p role="alert" className="text-sm text-[#b4532a]">{error}</p>}
    </form>
  );
}
