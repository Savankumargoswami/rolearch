"use client";

import { useState, useTransition } from "react";
import { setNewsletter } from "@/app/newsletter/actions";
import { t, type MessageKey } from "@/i18n";
import { CATEGORIES } from "@/lib/categories";

export function NewsletterToggle({ subscribed, category }: { subscribed: boolean; category: string }) {
  const [on, setOn] = useState(subscribed);
  const [field, setField] = useState(category);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();

  const save = (nextOn: boolean, nextField: string) =>
    start(async () => {
      const r = await setNewsletter(nextOn, nextField);
      if (r.ok) {
        setOn(nextOn);
        setField(nextField);
        setMessage(nextOn ? t("newsletter.saved") : t("newsletter.off"));
      } else setMessage(r.message ?? t("newsletter.errSave"));
    });

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 font-medium">
        <input type="checkbox" className="size-5 accent-ink" checked={on} disabled={pending} onChange={(e) => save(e.target.checked, field)} />
        {t("newsletter.toggle")}
      </label>
      <label className="inline-flex items-center gap-2 text-sm">
        <span className="text-muted">{t("newsletter.field")}</span>
        <select
          className="min-h-11 rounded-full border border-line bg-paper px-3"
          value={field}
          disabled={pending}
          onChange={(e) => (on ? save(true, e.target.value) : setField(e.target.value))}
        >
          <option value="all">{t("newsletter.allFields")}</option>
          {CATEGORIES.filter((c) => c !== "other").map((c) => (
            <option key={c} value={c}>
              {t(`categories.${c}` as MessageKey)}
            </option>
          ))}
        </select>
      </label>
      <p role="status" className="w-full text-sm text-muted empty:hidden">
        {message}
      </p>
    </div>
  );
}
