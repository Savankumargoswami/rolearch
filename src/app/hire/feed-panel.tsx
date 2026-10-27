"use client";

import { CircleAlert, CircleCheck, Clock, Rss } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useId, useTransition } from "react";
import { t } from "@/i18n";
import { connectFeed, removeFeed, type FeedResult } from "./actions";

export type FeedRow = { id: string; url: string; status: "pending" | "ok" | "error"; jobCount: number | null; lastError: string | null; checkedAgo: string | null };

/** "Connect your job feed": paste the feed your hiring system already makes for job boards; jobs then stay in sync. */
export function FeedPanel({ feeds, verified }: { feeds: FeedRow[]; verified: boolean }) {
  const id = useId();
  const [state, action, pending] = useActionState<FeedResult | null, FormData>(connectFeed, null);

  return (
    <section id="feeds" aria-labelledby={`${id}-h`} className="mt-12 scroll-mt-24 rounded-3xl border border-line bg-surface p-5 sm:p-8">
      <h2 id={`${id}-h`} className="flex items-center gap-2 font-display text-2xl font-semibold tracking-[-0.02em]">
        <Rss aria-hidden="true" className="size-5 text-signal-ink" />
        {t("hire.feedTitle")}
      </h2>
      <p className="mt-2 max-w-[65ch] text-muted text-pretty">{t("hire.feedLead")}</p>
      <details className="mt-3 max-w-[65ch] text-sm">
        <summary className="cursor-pointer font-medium underline decoration-line underline-offset-4">{t("hire.feedWhereTitle")}</summary>
        <p className="mt-2 text-muted text-pretty">{t("hire.feedWhere")}</p>
      </details>

      {verified ? (
        <form action={action} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-sm font-medium">{t("hire.feedUrl")}</span>
            <input
              name="url"
              type="url"
              required
              inputMode="url"
              placeholder="https://"
              className="mt-1 block h-12 w-full rounded-xl border border-line bg-paper px-4 focus:border-ink focus:outline-none"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:opacity-60"
          >
            {pending ? t("hire.feedChecking") : t("hire.feedConnect")}
          </button>
        </form>
      ) : (
        <p className="mt-5 text-sm text-muted">{t("hire.errUnverified")}</p>
      )}
      <div aria-live="polite" className="mt-3 text-sm">
        {state?.ok && <p className="text-ink">{t("hire.feedConnected", { n: state.count })}</p>}
        {state && !state.ok && <p className="text-[#b4532a]">{state.message}</p>}
      </div>

      {feeds.length > 0 && (
        <ul className="mt-6 divide-y divide-line border-t border-line">
          {feeds.map((f) => <FeedItem key={f.id} feed={f} />)}
        </ul>
      )}
    </section>
  );
}

function FeedItem({ feed: f }: { feed: FeedRow }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const Icon = f.status === "ok" ? CircleCheck : f.status === "error" ? CircleAlert : Clock;
  const status =
    f.status === "ok"
      ? t("hire.feedOk", { n: f.jobCount ?? 0, ago: f.checkedAgo ?? "" })
      : f.status === "error"
        ? t("hire.feedError", { e: f.lastError ?? "" })
        : t("hire.feedPending", { n: f.jobCount ?? 0 });
  return (
    <li className="flex flex-col gap-2 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="truncate font-medium" title={f.url}>{f.url}</p>
        <p className={`mt-1 flex items-center gap-1.5 text-sm ${f.status === "error" ? "text-[#b4532a]" : "text-muted"}`}>
          <Icon aria-hidden="true" className="size-4 shrink-0" />
          {status}
        </p>
      </div>
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(t("hire.feedRemoveConfirm"))) return;
          start(async () => {
            await removeFeed(f.id);
            router.refresh();
          });
        }}
        className="inline-flex min-h-10 shrink-0 cursor-pointer items-center self-start rounded-full border border-line px-4 text-sm font-medium hover:border-ink disabled:opacity-60 sm:self-auto"
      >
        {t("hire.feedRemove")}
      </button>
    </li>
  );
}
