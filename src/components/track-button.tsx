"use client";

import { ArrowUpRight, Bookmark, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { trackJob, untrackJob } from "@/app/tracker/actions";
import { t } from "@/i18n";

/** Save a job to the member's tracker (or take it out again while it's only saved). */
export function TrackButton({ id, status }: { id: string; status: string | null }) {
  const router = useRouter();
  const [current, setCurrent] = useState(status);
  const [pending, start] = useTransition();
  const tracked = current !== null;
  const locked = tracked && current !== "saved"; // applied/interviewing/...: managed from the tracker

  return (
    <button
      type="button"
      aria-pressed={tracked}
      disabled={pending || locked}
      onClick={() =>
        start(async () => {
          const res = tracked ? await untrackJob(id) : await trackJob(id, "saved");
          if (res.ok) {
            setCurrent(tracked ? null : "saved");
            router.refresh();
          }
        })
      }
      className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-ink px-5 font-medium transition-colors duration-200 hover:bg-ink-soft disabled:cursor-default disabled:hover:bg-transparent"
    >
      <Bookmark aria-hidden="true" className={`size-4 transition-transform duration-200 ${tracked ? "scale-110 fill-ink" : ""}`} strokeWidth={1.75} />
      {tracked ? t("tracker.saved") : t("tracker.save")}
    </button>
  );
}

/** "Apply on company site", then asks whether they applied so the tracker can record it. */
export function ExternalApply({ id, url, company, applied }: { id: string; url: string; company: string; applied: boolean }) {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [done, setDone] = useState(applied);
  const [pending, start] = useTransition();

  return (
    <>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (!done) setAsking(true);
        }}
        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
      >
        {t("job.apply")}
        <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        <span className="sr-only">{t("job.opensNewTab")}</span>
      </a>
      {asking && !done && (
        <div role="status" className="rounded-xl border border-line bg-paper p-3">
          <p className="text-sm font-medium">{t("apply.externalAsk", { company })}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const res = await trackJob(id, "applied");
                  if (res.ok) {
                    setDone(true);
                    router.refresh();
                  }
                })
              }
              className="inline-flex min-h-10 cursor-pointer items-center rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover"
            >
              {t("apply.externalYes")}
            </button>
            <button type="button" onClick={() => setAsking(false)} className="inline-flex min-h-10 cursor-pointer items-center rounded-full border border-line px-4 text-sm hover:border-ink">
              {t("apply.externalNo")}
            </button>
          </div>
        </div>
      )}
      {done && asking && (
        <p role="status" className="flex items-center gap-1.5 text-sm text-muted">
          <Check aria-hidden="true" className="size-4" />
          {t("apply.externalTracked")}
        </p>
      )}
    </>
  );
}
