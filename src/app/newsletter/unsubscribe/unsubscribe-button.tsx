"use client";

import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { unsubscribeToken } from "../actions";

export function UnsubscribeButton({ token }: { token: string }) {
  const [done, setDone] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p className="mt-6 font-medium">{t("newsletter.unsubDone")}</p>;
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => setDone(await unsubscribeToken(token)))}
        className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
      >
        {t("newsletter.unsubButton")}
      </button>
      {done === false && <p className="mt-3 text-sm text-muted">{t("newsletter.unsubFailed")}</p>}
    </div>
  );
}
