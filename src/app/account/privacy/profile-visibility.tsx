"use client";

import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { setProfileHidden } from "./actions";

/** "Hide my profile": out of member search, recruiter search and other members' view of /u/{id}. */
export function ProfileVisibility({ initial }: { initial: boolean }) {
  const [hidden, setHidden] = useState(initial);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const toggle = () =>
    start(async () => {
      setError("");
      const next = !hidden;
      const res = await setProfileHidden(next);
      if (res.ok) setHidden(next);
      else setError(res.message ?? "");
    });
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">{t("visibility.title")}</p>
          <p className="mt-1 text-sm text-muted">{t("visibility.lead")}</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={hidden}
          aria-label={t("visibility.title")}
          disabled={busy}
          onClick={toggle}
          className={`relative mt-1 inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 disabled:opacity-60 ${hidden ? "bg-[#1f7a4d]" : "bg-ink/25"}`}
        >
          <span className={`inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ${hidden ? "translate-x-6" : "translate-x-1"}`} />
        </button>
      </div>
      <ul className="mt-3 list-disc space-y-1 ps-5 text-sm text-muted">
        <li>{t("visibility.p1")}</li>
        <li>{t("visibility.p2")}</li>
      </ul>
      <p role="status" className="mt-2 text-xs text-muted">
        {hidden ? t("visibility.on") : t("visibility.off")}
      </p>
      {error && (
        <p role="alert" className="mt-1 text-sm text-[#b4532a]">
          {error}
        </p>
      )}
    </div>
  );
}
