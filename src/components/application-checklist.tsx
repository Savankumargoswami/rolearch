"use client";

import { Check, ClipboardCheck } from "lucide-react";
import { useEffect, useState } from "react";
import { t, type MessageKey } from "@/i18n";

const ITEMS = ["fit", "tailored", "honest", "screening", "letter", "version", "apply", "track", "followUp"] as const;
type Item = (typeof ITEMS)[number];

/**
 * The application checklist that completes a truthful tailored application: fit checked, resume tailored with only
 * true edits, screening questions confirmed, cover letter, version saved, applied, tracked, follow-up set. Some items
 * tick themselves from what the person has done here; the rest they tick. Saved in this browser per job.
 */
export function ApplicationChecklist({ jobKey, auto, confirm }: { jobKey: string; auto: Partial<Record<Item, boolean>>; confirm: string[] }) {
  const storage = `rolearch:checklist:${jobKey}`;
  const [ticked, setTicked] = useState<Item[]>([]);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storage);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring this browser's saved ticks after mount
      if (raw) setTicked((JSON.parse(raw) as Item[]).filter((x) => (ITEMS as readonly string[]).includes(x)));
    } catch {}
  }, [storage]);
  const toggle = (i: Item) =>
    setTicked((cur) => {
      const next = cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i];
      try {
        localStorage.setItem(storage, JSON.stringify(next));
      } catch {}
      return next;
    });
  const done = (i: Item) => Boolean(auto[i]) || ticked.includes(i);
  const count = ITEMS.filter(done).length;

  return (
    <section aria-labelledby="checklist-h" className="mt-6 rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 id="checklist-h" className="flex items-center gap-2 font-display font-semibold">
          <ClipboardCheck aria-hidden="true" className="size-5" />
          {t("checklist.title")}
        </h3>
        <span className="text-sm tabular-nums text-muted">{t("checklist.progress", { done: count, total: ITEMS.length })}</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-soft">
        <span className="block h-full rounded-full bg-[#1f7a4d] transition-[width] duration-500" style={{ width: `${(count / ITEMS.length) * 100}%` }} />
      </div>
      <ul className="mt-3 flex flex-col gap-1.5">
        {ITEMS.map((i) => {
          const on = done(i);
          const automatic = Boolean(auto[i]);
          return (
            <li key={i}>
              <label className={`flex min-h-10 items-start gap-3 rounded-xl px-2 py-1.5 text-sm ${automatic ? "" : "cursor-pointer hover:bg-ink-soft/60"}`}>
                <input type="checkbox" className="sr-only" checked={on} disabled={automatic} onChange={() => toggle(i)} />
                <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-md border ${on ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : "border-line"}`}>
                  {on && <Check className="size-3.5" />}
                </span>
                <span className={on ? "text-muted line-through decoration-muted/50" : ""}>
                  {t(`checklist.i_${i}` as MessageKey)}
                  {i === "screening" && confirm.length > 0 && <span className="block text-xs text-muted no-underline">{confirm.join(" · ")}</span>}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
