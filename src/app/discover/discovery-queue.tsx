"use client";

import { Bookmark, BookmarkCheck, Briefcase, Building2, Check, MapPin, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useSyncExternalStore, useTransition } from "react";
import { trackJob } from "@/app/tracker/actions";
import { CompanyLogo } from "@/components/company-logo";
import type { JobLite } from "@/data/types";
import { t } from "@/i18n";
import type { ListFit } from "@/lib/fit-list";
import { place, postedAgo } from "@/lib/format";

export type QueueItem = { job: JobLite; fit: ListFit; locationFit: number | null; reason: string };

// What the member has reviewed today and what they've discarded, kept in this browser only.
type Memory = { day: string; reviewed: string[]; saved: string[]; discarded: string[] };
const KEY = "ra.discover.queue";
const today = () => new Date().toISOString().slice(0, 10);
const listeners = new Set<() => void>();
const read = (): string => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("storage", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", fn);
  };
};
function parse(raw: string): Memory {
  // Nothing stored (or rendering on the server): no date needed.
  if (!raw) return { day: "", reviewed: [], saved: [], discarded: [] };
  const empty: Memory = { day: today(), reviewed: [], saved: [], discarded: [] };
  try {
    const m = JSON.parse(raw) as Memory;
    const discarded = Array.isArray(m.discarded) ? m.discarded.slice(-300) : [];
    // A new day resets the momentum counter but keeps what was discarded.
    if (m.day !== empty.day) return { ...empty, discarded };
    return { day: m.day, reviewed: m.reviewed ?? [], saved: m.saved ?? [], discarded };
  } catch {
    return empty;
  }
}
function write(m: Memory) {
  try {
    localStorage.setItem(KEY, JSON.stringify(m));
  } catch {
    /* private mode: the queue still works for this visit */
  }
  listeners.forEach((fn) => fn());
}

const TONE = { strong: "text-[#1f7a4d]", potential: "text-[#2c5585]", stretch: "text-signal-ink", poor: "text-[#b4532a]", insufficient: "text-muted" } as const;
const ringTone = (n: number) => (n >= 75 ? "#1f7a4d" : n >= 50 ? "#2c5585" : "var(--color-signal-ink)");

export function Ring({ value, label }: { value: number; label: string }) {
  const r = 22;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <figure className="flex flex-col items-center gap-1.5">
      <svg viewBox="0 0 56 56" className="size-16" role="img" aria-label={`${label}: ${v}%`}>
        <circle cx="28" cy="28" r={r} fill="none" stroke="currentColor" strokeWidth="5" className="text-line" />
        <circle
          cx="28"
          cy="28"
          r={r}
          fill="none"
          stroke={ringTone(v)}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`}
          transform="rotate(-90 28 28)"
        />
        <text x="28" y="32" textAnchor="middle" className="fill-current text-[11px] font-semibold tabular-nums">
          {v}%
        </text>
      </svg>
      <figcaption className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">{label}</figcaption>
    </figure>
  );
}

function Tile({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub?: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-xl border border-line bg-paper/40 p-3">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </span>
      <span className="truncate font-medium">{value}</span>
      {sub && <span className="truncate text-xs text-muted">{sub}</span>}
    </div>
  );
}

/** One role at a time: the best match first, with Bookmark and Discard, and a daily momentum counter. */
export function DiscoveryQueue({ items }: { items: QueueItem[] }) {
  const raw = useSyncExternalStore(subscribe, read, () => "");
  const memory = useMemo(() => parse(raw), [raw]);
  const [pending, start] = useTransition();

  const done = new Set([...memory.reviewed, ...memory.discarded]);
  const queue = items.filter((x) => !done.has(x.job.id));
  const current = queue[0];
  const goal = Math.min(5, items.length);
  const reviewed = memory.reviewed.filter((id) => items.some((x) => x.job.id === id)).length;
  const discardedHere = memory.discarded.filter((id) => items.some((x) => x.job.id === id)).length;

  const mark = (id: string, how: "saved" | "discarded" | "seen") => {
    const m = parse(read());
    if (!m.day) m.day = today();
    if (!m.reviewed.includes(id)) m.reviewed.push(id);
    if (how === "saved" && !m.saved.includes(id)) m.saved.push(id);
    if (how === "discarded" && !m.discarded.includes(id)) m.discarded.push(id);
    write(m);
  };
  const bookmark = (id: string) =>
    start(async () => {
      const res = await trackJob(id, "saved");
      if (res.ok) mark(id, "saved");
    });
  const restore = () => {
    const m = parse(read());
    const ids = new Set(items.map((x) => x.job.id));
    write({ ...m, discarded: m.discarded.filter((id) => !ids.has(id)), reviewed: m.reviewed.filter((id) => !ids.has(id)) });
  };

  const momentum = (
    <div className="mt-5 border-t border-line pt-4">
      <p className="text-sm font-semibold">{t("discover.momentum")}</p>
      <p className="text-sm text-muted">{t("discover.momentumCount", { n: Math.min(reviewed, goal), goal })}</p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-soft" aria-hidden="true">
        <div className="h-full rounded-full bg-signal transition-[width] duration-500" style={{ width: `${goal ? Math.min(100, (reviewed / goal) * 100) : 0}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted">
        {reviewed >= goal ? t("discover.momentumDone") : reviewed > 0 ? t("discover.momentumSome") : t("discover.momentumStart")}
      </p>
    </div>
  );

  if (!current) {
    return (
      <section aria-labelledby="queue-h" className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="queue-h" className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          {t("discover.queueTitle")}
        </h2>
        <p className="mt-2 font-display text-xl font-semibold">{t("discover.queueDone")}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="#all" className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover">
            {t("discover.seeAll")}
          </a>
          {discardedHere > 0 && (
            <button type="button" onClick={restore} className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 text-sm font-medium hover:border-ink">
              <RotateCcw aria-hidden="true" className="size-4" />
              {t("discover.restore", { n: discardedHere })}
            </button>
          )}
        </div>
        {momentum}
      </section>
    );
  }

  const { job, fit } = current;
  const third = current.locationFit !== null ? { v: current.locationFit, l: t("discover.ringLocation") } : { v: fit.dims.transferable ?? 0, l: t("discover.ringTransferable") };
  const saved = memory.saved.includes(job.id);
  const lastSaved = items.find((x) => x.job.id === memory.saved[memory.saved.length - 1]);

  return (
    <section aria-labelledby="queue-h" className="mt-6 overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3 sm:px-6">
        <h2 id="queue-h" className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">
          {t("discover.queueTitle")}
        </h2>
        <span className="text-xs text-muted tabular-nums">{t("discover.queueLeft", { n: queue.length })}</span>
      </div>
      <div className="grid md:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <CompanyLogo domain={job.companyDomain} name={job.company} size={48} />
            <div className="min-w-0">
              <Link href={`/jobs/${job.id}`} className="block font-display text-xl font-semibold tracking-[-0.01em] hover:underline hover:underline-offset-4 sm:text-2xl">
                {job.title}
              </Link>
              <p className="text-muted">
                {t("discover.at")} <span className="font-medium text-ink">{job.company}</span>
              </p>
              <p className="text-xs text-muted">{t("discover.posted", { when: postedAgo(job.postedDaysAgo) })}</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Tile icon={<MapPin aria-hidden="true" className="size-3.5" />} label={t("discover.tileLocation")} value={place(job)} />
            <Tile
              icon={<Building2 aria-hidden="true" className="size-3.5" />}
              label={t("discover.tileMode")}
              value={t(`posts.workplace_${job.workplace}`)}
              sub={job.visa ? t("discover.visa") : undefined}
            />
            <Tile
              icon={<Briefcase aria-hidden="true" className="size-3.5" />}
              label={t("discover.tileLevel")}
              value={t(`jobs.levels.${job.level}`)}
              sub={job.years ? t("discover.years", { n: job.years }) : undefined}
            />
          </div>
          <p className="mt-4 text-sm text-muted">{current.reason}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link
              href={`/jobs/${job.id}`}
              onClick={() => mark(job.id, "seen")}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover"
            >
              {t("discover.open")}
            </Link>
            <button
              type="button"
              disabled={pending || saved}
              onClick={() => bookmark(job.id)}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 font-medium hover:border-ink disabled:opacity-60"
            >
              {saved ? <BookmarkCheck aria-hidden="true" className="size-4" /> : <Bookmark aria-hidden="true" className="size-4" />}
              {saved ? t("discover.bookmarked") : t("discover.bookmark")}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => mark(job.id, "discarded")}
              className="inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border border-line px-4 font-medium text-muted hover:border-ink hover:text-ink"
            >
              <X aria-hidden="true" className="size-4" />
              {t("discover.discard")}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted">{t("discover.bookmarkNote")}</p>
        </div>
        <aside className="border-t border-line bg-paper/30 p-5 sm:p-6 md:border-t-0 md:border-l">
          <div className="flex items-start gap-4">
            <p className="shrink-0">
              <span className={`block font-display text-5xl font-semibold tabular-nums ${TONE[fit.verdict]}`}>
                {fit.score}
                <span className="text-2xl">%</span>
              </span>
              <span className="text-[0.7rem] font-semibold tracking-[0.12em] text-muted uppercase">{t("discover.fitScore")}</span>
            </p>
            <div className="min-w-0">
              <p className={`font-semibold ${TONE[fit.verdict]}`}>{t(`fit.verdict_${fit.verdict}`)}</p>
              <p className="text-sm text-muted">{t(`discover.why_${fit.verdict}`)}</p>
            </div>
          </div>
          <div className="mt-5 flex justify-between gap-2 sm:justify-start sm:gap-6">
            <Ring value={third.v} label={third.l} />
            <Ring value={fit.dims.experience ?? 0} label={t("discover.ringExperience")} />
            <Ring value={fit.dims.skills ?? 0} label={t("discover.ringAlignment")} />
          </div>
          {momentum}
          {lastSaved && (
            <p role="status" className="mt-3 flex items-start gap-1.5 text-sm text-[#1f7a4d]">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>
                {t("discover.savedNote", { title: lastSaved.job.title })}{" "}
                <Link href="/tracker" className="font-medium underline underline-offset-4">
                  {t("discover.openTracker")}
                </Link>
              </span>
            </p>
          )}
        </aside>
      </div>
    </section>
  );
}
