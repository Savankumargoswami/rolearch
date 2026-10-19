"use client";

import { MapPin } from "lucide-react";
import Form from "next/form";
import { useRef, useState } from "react";
import { t } from "@/i18n";
import { whereOptions } from "@/lib/regions";
import { SearchCombobox } from "./search-combobox";

const hints = ["Software engineer", "Registered nurse", "Truck driver", "Data analyst", "Warehouse associate", "Electrician"];

/** Works without JavaScript: it's a plain GET form to /jobs. JS adds suggestions and client navigation. */
export function HeroSearch() {
  const [q, setQ] = useState("");
  const form = useRef<HTMLFormElement>(null);

  return (
    <Form ref={form} action="/jobs" className="flex flex-col gap-3 sm:flex-row sm:items-stretch" role="search">
      <SearchCombobox
        name="q"
        label={t("hero.roleLabel")}
        value={q}
        onValueChange={setQ}
        onCommit={() => queueMicrotask(() => form.current?.requestSubmit())}
        placeholder={t("hero.roleLabel")}
        hints={hints}
        className="flex-1"
      />
      <div className="flex gap-3">
        <label className="relative flex-1 sm:w-52 sm:flex-none">
          <span className="sr-only">{t("hero.whereLabel")}</span>
          <MapPin aria-hidden="true" strokeWidth={1.75} className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <select
            name="where"
            defaultValue="anywhere"
            className="h-14 w-full cursor-pointer appearance-none rounded-full border border-line bg-surface ps-12 pe-9 text-[1.02rem] text-ink outline-none transition-colors duration-200 focus:border-ink"
          >
            {whereOptions.map((w) => (
              <option key={w} value={w}>
                {t(`regions.${w}` as const)}
              </option>
            ))}
          </select>
          <svg aria-hidden="true" viewBox="0 0 12 12" className="pointer-events-none absolute end-4 top-1/2 size-3 -translate-y-1/2 text-muted">
            <path d="M2 4.5 6 8l4-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </label>
        <button
          type="submit"
          className="h-14 shrink-0 cursor-pointer rounded-full bg-ink px-6 text-[1.02rem] font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
        >
          {t("hero.submit")}
        </button>
      </div>
    </Form>
  );
}
