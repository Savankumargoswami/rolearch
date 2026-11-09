"use client";

import { Suspense, use, useEffect, useState, useTransition } from "react";
import type { AtsTarget } from "@/app/ats/actions";
import { trackExternal } from "@/app/tracker/actions";
import { AtsPanel } from "@/components/ats-panel";
import { t } from "@/i18n";

const MIN = 200;

/** The free ATS check: paste any job from anywhere, then check a resume against it. */
type Viewer = { signedIn: boolean; hasProfile: boolean };

// Writing assistants (Grammarly and the like) rewrite the DOM around text boxes; these fields opt out so the
// page's own state stays the only thing editing them.
const noAssist = { "data-gramm": "false", "data-gramm_editor": "false", "data-enable-grammarly": "false", spellCheck: true } as const;

export function FreeCheck({ viewer }: { viewer: Promise<Viewer> }) {
  const [title, setTitle] = useState("");
  const [company, setCompany] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const ready = title.trim().length > 1 && description.trim().length >= MIN;
  const [fromExtension, setFromExtension] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  // The Rolearch browser extension hands over the posting the member is looking at. Its bridge script runs in this
  // page and posts the job here; only messages from this same window and origin are accepted.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.source !== window || e.origin !== window.location.origin) return;
      const d = e.data as { type?: string; job?: Record<string, unknown> } | null;
      if (d?.type !== "rolearch-extension-job" || !d.job) return;
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
      setTitle(str(d.job.title, 200));
      setCompany(str(d.job.company, 120));
      setUrl(str(d.job.url, 500));
      setDescription(str(d.job.description, 50000));
      setFromExtension(true);
      setSaved(null);
    }
    window.addEventListener("message", onMessage);
    window.postMessage({ type: "rolearch-extension-ready" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  function save() {
    startSave(async () => {
      const r = await trackExternal({ title: title.trim(), company: company.trim(), url: url.trim() });
      setSaved(r.ok ? t("atsFree.savedTracker") : r.message);
    });
  }

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
        {fromExtension && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-ink-soft px-4 py-3 text-sm">
            <p className="max-w-[48ch] text-pretty">{t("atsFree.fromExtension")}</p>
            {/^https?:\/\//.test(url.trim()) && title.trim() &&
              (saved ? (
                <p aria-live="polite" className="font-medium">{saved}</p>
              ) : (
                <button
                  type="button"
                  onClick={save}
                  disabled={saving}
                  className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 font-medium text-paper transition-transform hover:bg-ink-hover active:scale-[0.96] disabled:opacity-60"
                >
                  {t("atsFree.saveTracker")}
                </button>
              ))}
          </div>
        )}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("atsFree.titleLabel")}</span>
            <input
              {...noAssist}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder={t("atsFree.titlePlaceholder")}
              className={`h-11 ${field}`}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("atsFree.companyLabel")}</span>
            <input {...noAssist} value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} className={`h-11 ${field}`} />
          </label>
        </div>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("atsFree.urlLabel")}</span>
          <input
            {...noAssist}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            type="url"
            maxLength={500}
            placeholder="https://"
            className={`h-11 ${field}`}
          />
          <span className="text-muted">{t("atsFree.urlHint")}</span>
        </label>
        <label className="mt-3 flex flex-col gap-1.5 text-sm">
          <span className="font-medium">{t("atsFree.descLabel")}</span>
          <textarea
            {...noAssist}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={50000}
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
        <Suspense
          fallback={
            <AtsPanel
              target={{ title: title.trim(), company: company.trim(), description: description.trim(), url: url.trim() }}
              jobTitle={title.trim()}
              company={company.trim()}
              signedIn={false}
              hasProfile={false}
              next="/ats"
              ready={ready}
              lead={ready ? t("atsFree.panelLead") : t("atsFree.panelWaiting")}
              onRestore={restore}
            />
          }
        >
          <PanelFor
            viewer={viewer}
            target={{ title: title.trim(), company: company.trim(), description: description.trim(), url: url.trim() }}
            jobTitle={title.trim()}
            company={company.trim()}
            next="/ats"
            ready={ready}
            lead={ready ? t("atsFree.panelLead") : t("atsFree.panelWaiting")}
            onRestore={restore}
          />
        </Suspense>
      </div>
    </div>
  );
}

/** The scan panel for whoever is viewing: signed in (scan and see results) or not (scan, then create an account). */
function PanelFor({ viewer, ...props }: { viewer: Promise<Viewer> } & Omit<React.ComponentProps<typeof AtsPanel>, "signedIn" | "hasProfile">) {
  const { signedIn, hasProfile } = use(viewer);
  return <AtsPanel {...props} signedIn={signedIn} hasProfile={hasProfile} />;
}
