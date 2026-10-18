"use client";

import { Check, Download, FileUp, Loader2, Save, ScanSearch, Sparkles, UserRound, X } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { checkProfile, checkUpload, downloadDocx, optimizeForJob, type Checked, type OptimizedResult } from "@/app/ats/actions";
import { saveProfile } from "@/app/account/profile/actions";
import { t, type MessageKey } from "@/i18n";
import type { AtsCheck, AtsPartId, AtsReport } from "@/lib/ats";
import type { ProfileData } from "@/lib/profile-schema";

type Source = "profile" | "upload";
type Ready = Extract<Checked, { ok: true }> & { source: Source };
type Better = Extract<OptimizedResult, { ok: true }>;

const PARTS: AtsPartId[] = ["hard", "title", "experience", "education", "soft", "parsing", "impact"];

export function AtsPanel({ jobId, jobTitle, company, signedIn, hasProfile }: { jobId: string; jobTitle: string; company: string; signedIn: boolean; hasProfile: boolean }) {
  const [tab, setTab] = useState<Source>(hasProfile ? "profile" : "upload");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Ready | null>(null);
  const [better, setBetter] = useState<Better | null>(null);
  const [confirmed, setConfirmed] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [checking, startCheck] = useTransition();
  const [optimizing, startOptimize] = useTransition();
  const [downloading, startDownload] = useTransition();
  const [saving, startSave] = useTransition();

  function run() {
    setError("");
    setNote("");
    setBetter(null);
    setConfirmed([]);
    startCheck(async () => {
      let res: Checked;
      if (tab === "profile") res = await checkProfile(jobId, phone);
      else {
        if (!file) return setError(t("profile.errNoFile"));
        const data = new FormData();
        data.set("resume", file);
        res = await checkUpload(jobId, data);
      }
      if (res.ok) setResult({ ...res, source: tab, contact: { ...res.contact, phone: res.contact.phone || phone } });
      else setError(res.message);
    });
  }

  function optimize() {
    if (!result) return;
    setError("");
    startOptimize(async () => {
      const res = await optimizeForJob(jobId, result.resume, result.contact, confirmed);
      if (res.ok) setBetter(res);
      else setError(res.message);
    });
  }

  function download(resume: ProfileData) {
    if (!result) return;
    startDownload(async () => {
      const res = await downloadDocx(resume, result.contact, company);
      if (!res.ok) return setError(res.message);
      const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
      const url = URL.createObjectURL(new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = res.filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
  }

  function saveToProfile() {
    if (!better) return;
    startSave(async () => {
      const res = await saveProfile(better.resume);
      if (res.ok) setNote(t("ats.savedToProfile"));
      else setError(res.message);
    });
  }

  if (!signedIn) {
    return (
      <Shell>
        <p className="mt-3 text-[0.95rem] text-muted">{t("ats.signInLead")}</p>
        <Link href="/signin" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("nav.signIn")}
        </Link>
      </Shell>
    );
  }

  const report = better?.report ?? result?.report ?? null;

  return (
    <Shell>
      <div role="tablist" aria-label={t("ats.title")} className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-ink-soft p-1">
        {(["profile", "upload"] as const).map((s) => (
          <button
            key={s}
            role="tab"
            type="button"
            aria-selected={tab === s}
            onClick={() => setTab(s)}
            className={`inline-flex min-h-10 cursor-pointer items-center justify-center gap-1.5 rounded-full text-sm font-medium transition-colors duration-200 ${tab === s ? "bg-surface shadow-sm" : "text-muted hover:text-ink"}`}
          >
            {s === "profile" ? <UserRound aria-hidden="true" className="size-4" /> : <FileUp aria-hidden="true" className="size-4" />}
            {s === "profile" ? t("ats.tabProfile") : t("ats.tabUpload")}
          </button>
        ))}
      </div>

      <div role="tabpanel" className="mt-4 flex flex-col gap-3">
        {tab === "profile" ? (
          hasProfile ? (
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("ats.phoneLabel")}</span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+1 555 123 4567"
                className="h-11 rounded-xl border border-line bg-surface px-3 text-[0.95rem] outline-none focus:border-ink"
              />
              <span className="text-muted">{t("ats.phoneHint")}</span>
            </label>
          ) : (
            <p className="text-sm text-muted">
              {t("ats.noProfile")}{" "}
              <Link href="/account/profile" className="font-medium text-ink underline underline-offset-4">
                {t("profile.build")}
              </Link>
            </p>
          )
        ) : (
          <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-muted/60 px-3 py-2 text-sm hover:border-ink">
            <FileUp aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate">{file ? file.name : t("ats.uploadLabel")}</span>
            <input
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="sr-only"
            />
          </label>
        )}
        <button
          type="button"
          onClick={run}
          disabled={checking || (tab === "profile" ? !hasProfile : !file)}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {checking ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <ScanSearch aria-hidden="true" className="size-4" />}
          {checking ? (tab === "upload" ? t("ats.reading") : t("ats.checking")) : t("ats.check")}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-signal-ink">
          {error}
        </p>
      )}

      {report && result && (
        <div className="mt-6 border-t border-line pt-5" aria-live="polite">
          <ScoreHeader score={report.score} before={better?.before} />
          <Breakdown report={report} />
          <Keywords
            report={report}
            confirmed={confirmed}
            onToggle={(k) => setConfirmed((c) => (c.includes(k) ? c.filter((x) => x !== k) : [...c, k]))}
            locked={Boolean(better)}
          />
          <Checks checks={report.checks} jobTitle={jobTitle} report={report} />

          {!better ? (
            <div className="mt-5 rounded-2xl bg-ink p-4 text-paper">
              <p className="font-display font-semibold">{t("ats.optimizeTitle")}</p>
              <p className="mt-1 text-sm text-[#c9d2de]">{t("ats.optimizeLead")}</p>
              <button
                type="button"
                onClick={optimize}
                disabled={optimizing}
                className="mt-3 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-signal px-5 font-medium text-ink transition-colors duration-200 hover:bg-[#ebb877] disabled:cursor-wait disabled:opacity-70"
              >
                {optimizing ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Sparkles aria-hidden="true" className="size-4" />}
                {optimizing ? t("ats.optimizing") : t("ats.optimize")}
              </button>
              <button
                type="button"
                onClick={() => download(result.resume)}
                disabled={downloading}
                className="mt-2 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 rounded-full text-sm text-[#dfe5ec] hover:text-paper"
              >
                <Download aria-hidden="true" className="size-4" />
                {t("ats.downloadCurrent")}
              </button>
            </div>
          ) : (
            <Improved better={better} source={result.source} onDownload={() => download(better.resume)} onSave={saveToProfile} downloading={downloading} saving={saving} />
          )}
          {note && (
            <p role="status" className="mt-3 text-sm font-medium">
              {note}
            </p>
          )}
          <p className="mt-4 text-xs leading-relaxed text-muted">{t("ats.disclaimer")}</p>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="ats-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="ats-h" className="flex items-center gap-2 font-display text-xl font-semibold">
        <ScanSearch aria-hidden="true" className="size-5 text-signal-ink" />
        {t("ats.title")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("ats.lead")}</p>
      {children}
    </section>
  );
}

const band = (s: number) => (s >= 80 ? "strong" : s >= 65 ? "good" : "low");

function ScoreHeader({ score, before }: { score: number; before?: number }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  const b = band(score);
  const color = b === "strong" ? "var(--color-ink)" : b === "good" ? "var(--color-signal)" : "#b4532a";
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" role="img" aria-label={t("ats.scoreAria", { n: score })}>
        <circle cx="40" cy="40" r={r} fill="none" stroke="var(--color-ink-soft)" strokeWidth="8" />
        <circle cx="40" cy="40" r={r} fill="none" stroke={color} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} className="transition-[stroke-dashoffset] duration-700" />
        <text x="40" y="40" dominantBaseline="central" textAnchor="middle" transform="rotate(90 40 40)" className="fill-ink font-display text-[22px] font-semibold">
          {score}
        </text>
      </svg>
      <div>
        <p className="font-display text-lg font-semibold">{t(`ats.band_${b}` as MessageKey)}</p>
        {before !== undefined ? (
          <p className="text-sm">
            <span className="text-muted line-through">{before}</span> → <strong className="text-ink">{score}</strong> {t("ats.afterTailoring")}
          </p>
        ) : (
          <p className="text-sm text-muted">{t("ats.target")}</p>
        )}
      </div>
    </div>
  );
}

function Breakdown({ report }: { report: AtsReport }) {
  return (
    <ul className="mt-5 flex flex-col gap-2.5">
      {PARTS.map((id) => {
        const p = report.parts.find((x) => x.id === id)!;
        const pct = p.max ? (p.points / p.max) * 100 : 0;
        return (
          <li key={id} className="text-sm">
            <div className="flex justify-between gap-2">
              <span className="font-medium">{t(`ats.part_${id}` as MessageKey)}</span>
              <span className="tabular-nums text-muted">
                {Math.round(p.points)}/{p.max}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-ink-soft">
              <div className={`h-full rounded-full transition-[width] duration-700 ${pct >= 80 ? "bg-ink" : pct >= 50 ? "bg-signal" : "bg-[#b4532a]"}`} style={{ width: `${Math.max(3, pct)}%` }} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Keywords({ report, confirmed, onToggle, locked }: { report: AtsReport; confirmed: string[]; onToggle: (k: string) => void; locked: boolean }) {
  const found = report.keywords.filter((k) => k.inResume > 0);
  const missing = report.keywords.filter((k) => k.inResume === 0);
  return (
    <div className="mt-6">
      <h3 className="font-semibold">{t("ats.keywordsTitle", { found: found.length, total: report.keywords.length })}</h3>
      {missing.length > 0 && (
        <>
          <p className="mt-1 text-sm text-muted">{locked ? t("ats.missingAfter") : t("ats.missingLead")}</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {missing.map((k) => {
              const on = confirmed.includes(k.name);
              return (
                <li key={k.name}>
                  <label
                    className={`inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3 text-sm transition-colors ${on ? "border-ink bg-ink text-paper" : "border-dashed border-muted/70 hover:border-ink"} ${locked ? "pointer-events-none opacity-70" : ""}`}
                  >
                    <input type="checkbox" className="sr-only" checked={on} disabled={locked} onChange={() => onToggle(k.name)} />
                    {on ? <Check aria-hidden="true" className="size-3.5" /> : <X aria-hidden="true" className="size-3.5 text-[#b4532a]" />}
                    {k.name}
                    {k.inJob > 1 && <span className="text-xs opacity-70">×{k.inJob}</span>}
                  </label>
                </li>
              );
            })}
          </ul>
        </>
      )}
      {found.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {found.map((k) => (
            <li key={k.name} className="inline-flex items-center gap-1 rounded-full bg-ink-soft px-2.5 py-1 text-xs font-medium">
              <Check aria-hidden="true" className="size-3.5" />
              {k.name}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Checks({ checks, jobTitle, report }: { checks: AtsCheck[]; jobTitle: string; report: AtsReport }) {
  const sorted = [...checks].sort((a, b) => Number(a.ok) - Number(b.ok));
  const text = (c: AtsCheck) => {
    const [n, total] = c.detail.split("/");
    const vars = { title: jobTitle, have: report.resumeYears, need: report.requiredYears, n, total, words: c.detail, level: t(`ats.degree_${c.detail}` as MessageKey) };
    const key = c.id === "title" ? `ats.check_title_${c.detail}` : `ats.check_${c.id}_${c.ok ? "ok" : "fail"}`;
    return t(key as MessageKey, vars);
  };
  return (
    <div className="mt-6">
      <h3 className="font-semibold">{t("ats.checksTitle")}</h3>
      <ul className="mt-2 flex flex-col gap-2">
        {sorted.map((c) => (
          <li key={c.id} className="flex gap-2.5 text-sm leading-snug">
            <span className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full ${c.ok ? "bg-ink text-paper" : "bg-[#b4532a]/15 text-[#b4532a]"}`}>
              {c.ok ? <Check aria-hidden="true" className="size-3" strokeWidth={3} /> : <X aria-hidden="true" className="size-3" strokeWidth={3} />}
            </span>
            <span className={c.ok ? "text-muted" : ""}>{text(c)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Improved({ better, source, onDownload, onSave, downloading, saving }: { better: Better; source: Source; onDownload: () => void; onSave: () => void; downloading: boolean; saving: boolean }) {
  const [all, setAll] = useState(false);
  const changes = all ? better.changes : better.changes.slice(0, 4);
  return (
    <div className="mt-6 rounded-2xl border border-signal/50 bg-signal/10 p-4">
      <p className="flex items-center gap-2 font-display font-semibold">
        <Sparkles aria-hidden="true" className="size-4 text-signal-ink" />
        {t("ats.tailoredTitle")}
      </p>
      {better.changes.length > 0 && (
        <ol className="mt-3 flex flex-col gap-3">
          {changes.map((c, i) => (
            <li key={i} className="rounded-xl bg-surface p-3 text-sm">
              <p className="text-xs font-semibold tracking-wide text-signal-ink uppercase">{c.section}</p>
              {c.before && <p className="mt-1 text-muted line-through decoration-muted/60">{c.before}</p>}
              <p className="mt-1">{c.after}</p>
              {c.why && <p className="mt-1 text-xs text-muted">{c.why}</p>}
            </li>
          ))}
        </ol>
      )}
      {better.changes.length > 4 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-9 cursor-pointer text-sm font-medium underline underline-offset-4">
          {all ? t("ats.showFewer") : t("ats.showAll", { n: better.changes.length })}
        </button>
      )}
      {better.skipped.length > 0 && (
        <div className="mt-3 text-sm">
          <p className="font-medium">{t("ats.skippedTitle")}</p>
          <ul className="mt-1 list-disc space-y-0.5 ps-5 text-muted">
            {better.skipped.slice(0, 6).map((s) => (
              <li key={s.keyword}>
                <strong className="text-ink">{s.keyword}</strong>: {s.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-4 flex flex-col gap-2">
        <button
          type="button"
          onClick={onDownload}
          disabled={downloading}
          className="inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
        >
          {downloading ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Download aria-hidden="true" className="size-4" />}
          {t("ats.download")}
        </button>
        {source === "profile" && (
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full border border-ink px-5 font-medium hover:bg-ink hover:text-paper disabled:opacity-60"
          >
            <Save aria-hidden="true" className="size-4" />
            {t("ats.saveToProfile")}
          </button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted">{t("ats.reviewNote")}</p>
    </div>
  );
}
