"use client";

import { MapPin, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import type { JobQuery } from "@/data/db";
import type { Level } from "@/data/types";
import { t, type MessageKey } from "@/i18n";
import { BLUE, WHITE } from "@/lib/categories";
import { whereOptions, type Where } from "@/lib/regions";
import { toQueryString } from "@/lib/job-query";
import { SearchCombobox } from "./search-combobox";

const levels: (Level | "any")[] = ["any", "entry", "mid", "senior", "lead"];
const nf = new Intl.NumberFormat("en");

/**
 * Search box, category rail and filters for /jobs. Results are rendered on the server from the URL;
 * changing a control updates the URL (typing is debounced), which re-runs the search in the database.
 */
export function JobsControls({ filters, counts }: { filters: JobQuery; counts: Record<string, number> }) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(filters.q);
  const [pending, start] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function go(next: JobQuery) {
    start(() => router.replace(`${pathname}${toQueryString(next)}`, { scroll: false }));
  }
  function update(patch: Partial<JobQuery>) {
    go({ ...filters, q: query, ...patch });
  }
  function type(v: string) {
    setQuery(v);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => go({ ...filters, q: v }), 300);
  }
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const groupCount = (cats: readonly string[]) => cats.reduce((s, c) => s + (counts[c] ?? 0), 0);
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  const rail: { value: string; label: string; n: number }[] = [
    { value: "all", label: t("categories.all"), n: total },
    { value: "white", label: t("categories.white"), n: groupCount(WHITE) },
    { value: "blue", label: t("categories.blue"), n: groupCount(BLUE) },
    ...Object.entries(counts)
      .filter(([c, n]) => n > 0 && c !== "other")
      .sort((a, b) => b[1] - a[1])
      .map(([c, n]) => ({ value: c, label: t(`categories.${c}` as MessageKey), n })),
  ];
  const chips: { key: "remote" | "visa" | "pay"; label: string }[] = [
    { key: "remote", label: t("jobs.remoteOnly") },
    { key: "visa", label: t("jobs.visa") },
    { key: "pay", label: t("jobs.salaryShown") },
  ];
  const anyActive = query !== "" || filters.cat !== "all" || filters.where !== "anywhere" || filters.remote || filters.visa || filters.pay || filters.level !== "any";

  return (
    <div className="sticky top-0 z-10 -mx-4 border-b border-line bg-paper/95 px-4 pb-3 pt-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
      <div aria-hidden="true" className={`absolute inset-x-0 bottom-0 h-0.5 bg-signal transition-opacity duration-300 ${pending ? "animate-pulse opacity-100" : "opacity-0"}`} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <SearchCombobox
          name="q"
          label={t("jobs.searchLabel")}
          value={query}
          onValueChange={type}
          onCommit={(v) => go({ ...filters, q: v })}
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

      <div role="group" aria-label={t("jobs.categoriesLabel")} className="rail -mx-4 mt-3 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {rail.map((c, i) => {
          const on = filters.cat === c.value;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={on}
              onClick={() => update({ cat: c.value })}
              className={`inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full border px-4 text-[0.92rem] transition-colors duration-200 ${
                on ? "border-ink bg-ink text-paper" : i < 3 ? "border-ink/40 bg-surface font-medium hover:border-ink" : "border-line bg-surface hover:border-ink"
              }`}
            >
              {c.label}
              <span className={`text-xs tabular-nums ${on ? "text-[#c9d2de]" : "text-muted"}`}>{nf.format(c.n)}</span>
            </button>
          );
        })}
      </div>

      <div role="group" aria-label={t("jobs.filters")} className="rail -mx-4 mt-2 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {chips.map((c) => {
          const on = filters[c.key];
          return (
            <button
              key={c.key}
              type="button"
              aria-pressed={on}
              onClick={() => update({ [c.key]: !on } as Partial<JobQuery>)}
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
          onChange={(v) => update({ level: v })}
          options={levels.map((l) => ({ value: l, label: t(`jobs.levels.${l}` as const) }))}
          on={filters.level !== "any"}
        />
        <ChipSelect
          label={t("jobs.sort")}
          value={filters.sort}
          onChange={(v) => update({ sort: v as JobQuery["sort"] })}
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
              go({ q: "", cat: "all", where: "anywhere", remote: false, visa: false, pay: false, level: "any", sort: filters.sort });
            }}
            className="inline-flex h-10 shrink-0 cursor-pointer items-center gap-1 rounded-full px-3 text-[0.92rem] text-muted underline-offset-4 hover:text-ink hover:underline"
          >
            <X aria-hidden="true" className="size-4" />
            {t("jobs.clear")}
          </button>
        )}
      </div>
    </div>
  );
}

function ChipSelect({ label, value, onChange, options, on }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]; on: boolean }) {
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
