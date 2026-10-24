"use client";

import { useState } from "react";
import type { AtsTarget } from "@/app/ats/actions";
import { AtsPanel } from "@/components/ats-panel";
import { t } from "@/i18n";

const MIN = 200;

/** The free ATS check: paste any job from anywhere, then check a resume against it. */
export function FreeCheck({ signedIn, hasProfile }: { signedIn: boolean; hasProfile: boolean }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const ready = title.trim().length > 1 && description.trim().length >= MIN;

  function restore(target: AtsTarget) {
    if (typeof target === "string") return;
    setTitle(target.title);
    setCompany(target.company ?? "");
    setUrl(target.url ?? "");
    setDescription(target.description);
  }

  const field = "rounded-xl border border-line bg-surface px-3 text-[0.95rem] outline-none focus:border-ink";
  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr] lg:items-start">
      <section aria-labelledby="job-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="job-h" className="font-display text-xl font-semibold">
          <span className="me-2 inline-grid size-7 place-items-center rounded-full bg-ink text-sm text-paper">1</span>
          {t("atsFree.jobTitle")}
        </h2>
        <p className="mt-1 text-sm text-muted">{t("atsFree.jobLead")}</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("atsFree.titleLabel")}</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} placeholder={t("atsFree.titlePlaceholder")} className={`h-11 ${field}`} />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("atsFree.companyLabel")}</span>
            <input value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} className={`h-11 ${field}`} />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("atsFree.urlLabel")}</span>
          <input value={url} onChange={(e) => setUrl(e.target.value)} type="url" maxLength={500} placeholder="https://" className={`h-11 ${field}`} />
          <span className="text-muted">{t("atsFree.urlHint")}</span>
        </label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("atsFree.descLabel")}</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={20000}
            rows={12}
            placeholder={t("atsFree.descPlaceholder")}
            className={`py-2.5 leading-relaxed ${field}`}
          />
          <span className="text-muted" aria-live="polite">
            {description.trim().length < MIN ? t("atsFree.descShort", { n: MIN - description.trim().length }) : t("atsFree.descOk")}
          </span>
        </label>
      </section>
      <div className="lg:sticky lg:top-24">
        <AtsPanel
          target={{ title: title.trim(), company: company.trim(), description: description.trim(), url: url.trim() }}
          jobTitle={title.trim()}
          company={company.trim()}
          signedIn={signedIn}
          hasProfile={hasProfile}
          next="/ats"
          ready={ready}
          lead={ready ? t("atsFree.panelLead") : t("atsFree.panelWaiting")}
          onRestore={restore}
        />
      </div>
    </div>
  );
}
