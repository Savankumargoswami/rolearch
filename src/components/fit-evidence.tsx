import { t } from "@/i18n";
import { fitValidation } from "@/lib/fit-validation";

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** "How accurate is the fit score?": shown only once the score is validated against real outcomes (lib/fit-validation). */
export async function FitEvidence() {
  const v = await fitValidation();
  if (!v) return null;
  const top = Math.max(...v.bands.map((b) => b.hi));
  return (
    <section aria-labelledby="fit-evidence-h" className="mt-10 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="fit-evidence-h" className="font-display text-xl font-semibold tracking-[-0.01em]">
        {t("fitEvidence.title")}
      </h2>
      <p className="mt-1 text-muted">
        {t("fitEvidence.lead", { n: v.n.toLocaleString("en-US"), high: pct(v.high.rate), highBand: v.high.key, low: pct(v.low.rate), lowBand: v.low.key })}
      </p>
      <ul className="mt-4 flex flex-col gap-2">
        {v.bands.map((b) => (
          <li key={b.key} className="grid grid-cols-[5.5rem_1fr_7.5rem] items-center gap-3 text-sm">
            <span>{t("fitEvidence.band", { band: b.key })}</span>
            <span className="relative h-2.5 rounded-full bg-ink-soft">
              <span className="absolute inset-y-0 rounded-full bg-signal/35" style={{ left: `${(b.lo / top) * 100}%`, width: `${((b.hi - b.lo) / top) * 100}%` }} />
              <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-signal-ink" style={{ left: `${(b.rate / top) * 100}%` }} />
            </span>
            <span className="text-end tabular-nums">
              {pct(b.rate)} <span className="text-xs text-muted">({b.n})</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-xs text-muted">{t("fitEvidence.note", { auc: v.auc.toFixed(2) })}</p>
    </section>
  );
}
