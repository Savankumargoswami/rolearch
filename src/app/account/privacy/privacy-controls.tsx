"use client";

import { Download, Loader2, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { deleteMyAccount, exportMyData } from "./actions";

/** Download all my data, and delete my account (with the email typed to confirm). */
export function PrivacyControls() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [email, setEmail] = useState("");
  const [confirming, setConfirming] = useState(false);

  const download = () =>
    start(async () => {
      setError("");
      const res = await exportMyData();
      if (!res.ok) return setError(res.message);
      const url = URL.createObjectURL(new Blob([res.json], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      URL.revokeObjectURL(url);
    });

  const remove = () =>
    start(async () => {
      setError("");
      const res = await deleteMyAccount(email);
      if (res.ok) {
        router.push("/");
        router.refresh();
      }
      else setError(res.message ?? "");
    });

  return (
    <div className="mt-8 flex flex-col gap-6">
      <section aria-labelledby="export-h" className="rounded-2xl border border-line bg-surface p-5">
        <h2 id="export-h" className="font-display text-xl font-semibold">
          {t("privacy.exportTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("privacy.exportBody")}</p>
        <button
          type="button"
          onClick={download}
          disabled={busy}
          className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
        >
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
          {t("privacy.exportButton")}
        </button>
      </section>

      <section aria-labelledby="delete-h" className="rounded-2xl border border-[#b4532a]/40 bg-surface p-5">
        <h2 id="delete-h" className="font-display text-xl font-semibold text-[#b4532a]">
          {t("privacy.deleteTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("privacy.deleteBody")}</p>
        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[#b4532a] px-5 font-medium text-[#b4532a] hover:bg-[#b4532a]/10"
          >
            <Trash2 aria-hidden="true" className="size-4" />
            {t("privacy.deleteButton")}
          </button>
        ) : (
          <div className="mt-3 flex flex-col gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{t("privacy.deleteConfirm")}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" className="h-11 rounded-xl border border-line bg-paper/40 px-3" />
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={remove}
                disabled={busy || !email.trim()}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-[#b4532a] px-5 font-medium text-white disabled:opacity-50"
              >
                {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Trash2 aria-hidden="true" className="size-4" />}
                {t("privacy.deleteFinal")}
              </button>
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 cursor-pointer rounded-full border border-line px-5 font-medium hover:border-ink">
                {t("privacy.cancel")}
              </button>
            </div>
          </div>
        )}
      </section>
      {error && (
        <p role="alert" className="text-sm font-medium text-[#b4532a]">
          {error}
        </p>
      )}
    </div>
  );
}
