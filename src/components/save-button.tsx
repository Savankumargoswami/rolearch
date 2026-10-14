"use client";

import { Bookmark } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "@/i18n";

const KEY = "rolearch:saved";
const EVENT = "rolearch:saved-change";

function read(): string[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(EVENT, onChange);
  };
}

/** Saved jobs live in this browser until accounts are live. */
export function SaveButton({ id }: { id: string }) {
  const saved = useSyncExternalStore(
    subscribe,
    () => read().includes(id),
    () => false,
  );

  return (
    <button
      type="button"
      aria-pressed={saved}
      onClick={() => {
        const next = saved ? read().filter((x) => x !== id) : [...read(), id];
        try {
          localStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
        window.dispatchEvent(new Event(EVENT));
      }}
      className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full border border-ink px-5 font-medium transition-colors duration-200 hover:bg-ink-soft"
    >
      <Bookmark aria-hidden="true" className={`size-4 transition-transform duration-200 ${saved ? "scale-110 fill-ink" : ""}`} strokeWidth={1.75} />
      {saved ? t("job.saved") : t("job.save")}
    </button>
  );
}
