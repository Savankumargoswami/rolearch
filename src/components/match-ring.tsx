import { t } from "@/i18n";
import type { Verdict } from "@/lib/match";

const stroke: Record<Verdict, string> = {
  strong: "var(--color-ink)",
  partial: "var(--color-muted)",
  weak: "#9aa3ae",
};

/** Match % as a ring. Strong matches get the one signal dot, so color is never the only cue. */
export function MatchRing({ score, verdict, size = 44 }: { score: number; verdict: Verdict; size?: number }) {
  const r = (size - 6) / 2;
  const c = 2 * Math.PI * r;
  const big = size >= 80;
  return (
    <span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-line)" strokeWidth={big ? 5 : 3} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={stroke[verdict]}
          strokeWidth={big ? 5 : 3}
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * c} ${c}`}
        />
      </svg>
      <span className={`absolute font-display font-semibold tabular-nums ${big ? "text-2xl" : "text-[0.74rem] tracking-[-0.02em]"}`}>
        {score}
        <span className={big ? "text-base" : "text-[0.52rem]"}>%</span>
      </span>
      {verdict === "strong" && (
        <span aria-hidden="true" className="absolute end-0 top-0 size-2.5 rounded-full border-2 border-surface bg-signal" />
      )}
      <span className="sr-only">{t("jobs.match", { n: score })}</span>
    </span>
  );
}
