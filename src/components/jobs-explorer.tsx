"use client";

import { MapPin, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { startTransition, useDeferredValue, useEffect, useState, ViewTransition } from "react";
import type { Level } from "@/data/types";
import { locale, t } from "@/i18n";
import { indexMeta } from "@/data/jobs-index";
import { emptyFilters, filterJobs, filtersToQuery, parseFilters, whereOptions, type Filters, type Where } from "@/lib/search";
import { JobRow } from "./job-row";
import { SearchCombobox } from "./search-combobox";

const levels: (Level | "any")[] = ["any", "entry", "mid", "senior", "lead"];
const PAGE = 40;

export function JobsExplorer() {
  const params = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(new URLSearchParams(params.toString())));
  const [query, setQuery] = useState(filters.q);
  // Typing updates the field at once; the list follows as a transition, so rows glide instead of jumping.
  const deferredQuery = useDeferredValue(query);
  const active = { ...filters, q: deferredQuery };
  const results = filterJobs(active);

  // Keep the URL shareable. Only write when it actually changes.
  const search = filtersToQuery(active);
  // How many rows are shown; tied to the search it was set for, so a new search starts at one page.
  const [page, setPage] = useState({ for: search, n: PAGE });
  const shown = page.for === search ? page.n : PAGE;
  useEffect(() => {
    if (window.location.search !== search) window.history.replaceState(null, "", `/jobs${search}`);
  }, [search]);

  function update(patch: Partial<Filters>) {
    startTransition(() => setFilters((f) => ({ ...f, ...patch })));
  }

  const chips: { key: "remote" | "visa" | "pay"; label: string }[] = [
    { key: "remote", label: t("jobs.remoteOnly") },
    { key: "visa", label: t("jobs.visa") },
    { key: "pay", label: t("jobs.salaryShown") },
  ];
  const anyActive =
    query !== "" || filters.where !== "anywhere" || filters.remote || filters.visa || filters.pay || filters.level !== "any";

  return (
    <div>
      <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 pb-3 pt-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchCombobox
            name="q"
            label={t("jobs.searchLabel")}
            value={query}
            onValueChange={setQuery}
            placeholder={t("jobs.searchPlaceholder")}
            className="flex-1"
            inputClassName="h-12"
          />
          <label className="relative sm:w-56">
            <span className="sr-only">{t("jobs.whereLabel")}</span>
            <MapPin aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <select
              value={filters.where}
              onChange={(e) => update({ where: e.target.value as Where })}
              className="h-12 w-full cursor-pointer appearance-none rounded-full border border-line bg-surface ps-12 pe-9 text-ink outline-none transition-colors duration-200 focus:border-ink"
            >
              {whereOptions.map((w) => (
                <option key={w} value={w}>
                  {t(`regions.${w}` as const)}
                </option>
              ))}
            </select>
            <Chevron />
          </label>
        </div>

        <div role="group" aria-label={t("jobs.filters")} className="rail -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {chips.map((c) => {
            const on = filters[c.key];
            return (
              <button
                key={c.key}
                type="button"
                aria-pressed={on}
                onClick={() => update({ [c.key]: !on } as Partial<Filters>)}
                className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[0.92rem] transition-colors duration-200 ${
                  on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:border-ink"
                }`}
              >
                {on && <span aria-hidden="true" className="size-1.5 rounded-full bg-signal" />}
                {c.label}
              </button>
            );
          })}
          <ChipSelect
            label={t("jobs.level")}
            value={filters.level}
            onChange={(v) => update({ level: v as Filters["level"] })}
            options={levels.map((l) => ({ value: l, label: t(`jobs.levels.${l}` as const) }))}
            on={filters.level !== "any"}
          />
          <ChipSelect
            label={t("jobs.sort")}
            value={filters.sort}
            onChange={(v) => update({ sort: v as Filters["sort"] })}
            options={[
              { value: "match", label: t("jobs.sortMatch") },
              { value: "newest", label: t("jobs.sortNewest") },
            ]}
            on={false}
          />
          {anyActive && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                update({ ...emptyFilters, sort: filters.sort });
              }}
              className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-[0.92rem] text-muted underline-offset-4 hover:text-ink hover:underline"
            >
              <X aria-hidden="true" className="size-4" />
              {t("jobs.clear")}
            </button>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <p aria-live="polite" className="font-display text-xl font-semibold tabular-nums">
          {results.length === 1 ? t("jobs.countOne") : t("jobs.count", { n: results.length })}
        </p>
        <p className="text-sm text-muted">{updatedNote()}</p>
      </div>

      {results.length > 0 ? (
        <ul className="-mx-3 mt-2 divide-y divide-line sm:-mx-4">
          {results.slice(0, shown).map((job) => (
            <ViewTransition key={job.id} enter="row-in" exit="row-out" update="row" default="none">
              <li>
                <JobRow job={job} />
              </li>
            </ViewTransition>
          ))}
        </ul>
      ) : null}
      {results.length > shown ? (
        <div className="mt-6 flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => startTransition(() => setPage({ for: search, n: shown + PAGE }))}
            className="min-h-12 cursor-pointer rounded-full border border-ink px-6 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper"
          >
            {t("jobs.showMore", { n: Math.min(PAGE, results.length - shown) })}
          </button>
          <p className="text-sm text-muted">{t("jobs.showing", { n: shown, total: results.length })}</p>
        </div>
      ) : null}
      {results.length === 0 && (
        <NoResults
          filters={active}
          onReset={(patch, q) => {
            if (q !== undefined) setQuery(q);
            update(patch);
          }}
        />
      )}
    </div>
  );
}

function NoResults({ filters, onReset }: { filters: Filters; onReset: (patch: Partial<Filters>, q?: string) => void }) {
  const options: { label: string; run: () => void }[] = [];
  if (filters.where !== "anywhere") options.push({ label: t("jobs.noneTryAnywhere"), run: () => onReset({ where: "anywhere" }) });
  if (filters.remote) options.push({ label: t("jobs.noneRemoveFilter", { f: t("jobs.remoteOnly") }), run: () => onReset({ remote: false }) });
  if (filters.visa) options.push({ label: t("jobs.noneRemoveFilter", { f: t("jobs.visa") }), run: () => onReset({ visa: false }) });
  if (filters.pay) options.push({ label: t("jobs.noneRemoveFilter", { f: t("jobs.salaryShown") }), run: () => onReset({ pay: false }) });
  if (filters.level !== "any")
    options.push({ label: t("jobs.noneRemoveFilter", { f: t(`jobs.levels.${filters.level}` as const) }), run: () => onReset({ level: "any" }) });
  const words = filters.q.trim().split(/\s+/);
  if (words.length > 1) options.push({ label: t("jobs.noneTry", { q: words[0] }), run: () => onReset({}, words[0]) });
  for (const q of ["Data engineer", "Python"]) {
    if (filters.q.toLowerCase() !== q.toLowerCase()) options.push({ label: t("jobs.noneTry", { q }), run: () => onReset({}, q) });
  }

  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-6 sm:p-8">
      <h2 className="font-display text-2xl font-semibold">{t("jobs.noneTitle")}</h2>
      <p className="mt-1 text-muted">{t("jobs.noneBody")}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {options.slice(0, 4).map((o) => (
          <button
            key={o.label}
            type="button"
            onClick={o.run}
            className="h-10 cursor-pointer rounded-full border border-ink px-4 text-[0.92rem] transition-colors duration-200 hover:bg-ink hover:text-paper"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChipSelect({
  label,
  value,
  onChange,
  options,
  on,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  on: boolean;
}) {
  return (
    <label className="relative shrink-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`h-10 cursor-pointer appearance-none rounded-full border ps-4 pe-9 text-[0.92rem] outline-none transition-colors duration-200 ${
          on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink hover:border-ink"
        }`}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Chevron className={on ? "text-paper" : undefined} />
    </label>
  );
}

function Chevron({ className = "text-muted" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 12 12" className={`pointer-events-none absolute end-4 top-1/2 size-3 -translate-y-1/2 ${className}`}>
      <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function updatedNote() {
  if (!indexMeta.generatedAt) return t("jobs.sampleNote");
  const when = new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short", timeZone: "UTC" }).format(new Date(indexMeta.generatedAt));
  return t("jobs.liveNote", { when: `${when} UTC`, k: indexMeta.companies });
}
