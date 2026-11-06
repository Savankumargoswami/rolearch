"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { deleteVersion, downloadVersion } from "./actions";

/** Download (PDF / Word) and delete buttons for one resume version. */
export function VersionActions({ id }: { id: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const get = (format: "pdf" | "docx") =>
    start(async () => {
      setError("");
      const res = await downloadVersion(id, format, "");
      if (!res.ok) return setError(res.message);
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: res.type }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    });
  return (
    <div className="flex flex-wrap items-center gap-2">
      {(["pdf", "docx"] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => get(f)}
          disabled={busy}
          className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
        >
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
          {f === "pdf" ? t("ats.downloadPdf") : t("ats.downloadWord")}
        </button>
      ))}
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (window.confirm(t("versions.confirmDelete")))
            start(async () => {
              const res = await deleteVersion(id);
              if (res.ok) router.refresh();
              else setError(res.message);
            });
        }}
        aria-label={t("versions.delete")}
        className="grid size-10 cursor-pointer place-items-center rounded-full hover:bg-ink-soft"
      >
        <Trash2 aria-hidden="true" className="size-4" />
      </button>
      {error && (
        <p role="alert" className="w-full text-sm text-[#b4532a]">
          {error}
        </p>
      )}
    </div>
  );
}
