"use client";

import { ArrowUpRight } from "lucide-react";
import { useState } from "react";
import { t } from "@/i18n";

/** In the live site this opens the company's apply URL and logs it to the tracker. */
export function ApplyButton({ company }: { company: string }) {
  const [shown, setShown] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setShown(true)}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
      >
        {t("job.apply")}
        <ArrowUpRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
      </button>
      {shown && (
        <p role="status" className="text-sm text-muted">
          {t("job.applyPreview", { c: company })}
        </p>
      )}
    </>
  );
}
