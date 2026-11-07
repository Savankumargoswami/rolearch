"use client";

import { Check } from "lucide-react";
import { useState } from "react";
import { t } from "@/i18n";
import type { Route } from "@/lib/transitions";

const W = 720;
const COL = [70, 360, 650];

/** Splits a role name over two lines for the graph ("Operations / process analyst"). */
function lines(name: string): string[] {
  if (name.length <= 20) return [name];
  const words = name.split(" ");
  let a = "";
  while (words.length && (a + " " + words[0]).trim().length <= 20) a = (a + " " + words.shift()).trim();
  const b = words.join(" ");
  return [a, b.length > 22 ? `${b.slice(0, 21)}…` : b];
}

/** Career Path Network Explorer: every route from the current role, with the chosen one highlighted. */
export function PathNetwork({ routes }: { routes: Route[] }) {
  const [sel, setSel] = useState(routes[0]?.id ?? "");
  if (!routes.length) return null;
  const chosen = routes.find((r) => r.id === sel) ?? routes[0];

  // Nodes per column: the current role, the bridge roles, and the goals.
  const start = routes[0].steps[0];
  const mids = [...new Set(routes.filter((r) => r.steps.length === 3).map((r) => r.steps[1]))];
  const ends = [...new Set(routes.map((r) => r.steps[r.steps.length - 1]))];
  const rows = Math.max(mids.length, ends.length, 1);
  const H = 70 + rows * 92;
  const y = (i: number, n: number) => (H - 30) / 2 + (i - (n - 1) / 2) * 92 + 6;
  const pos = new Map<string, [number, number]>();
  pos.set(`0:${start}`, [COL[0], y(0, 1)]);
  mids.forEach((m, i) => pos.set(`1:${m}`, [COL[1], y(i, mids.length)]));
  ends.forEach((e, i) => pos.set(`2:${e}`, [COL[2], y(i, ends.length)]));
  const at = (r: Route, i: number) => pos.get(`${r.steps.length === 2 && i === 1 ? 2 : i}:${r.steps[i]}`)!;
  const edges = (r: Route) => r.steps.slice(1).map((_, i) => [at(r, i), at(r, i + 1)] as const);
  const curve = ([x1, y1]: readonly [number, number], [x2, y2]: readonly [number, number]) => {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };
  const onChosen = (col: number, name: string) => chosen.steps.some((s, i) => s === name && (chosen.steps.length === 2 && i === 1 ? 2 : i) === col);

  return (
    <div>
      <div role="tablist" aria-label={t("gaps.netTabs")} className="mt-4 flex flex-wrap gap-2">
        {routes.map((r) => (
          <button
            key={r.id}
            type="button"
            role="tab"
            aria-selected={r.id === chosen.id}
            onClick={() => setSel(r.id)}
            className={`min-h-9 cursor-pointer rounded-full px-3.5 text-sm font-medium transition-colors ${r.id === chosen.id ? "bg-signal text-ink" : "bg-white/10 text-paper hover:bg-white/20"}`}
          >
            {r.kind === "nearby" ? r.steps[r.steps.length - 1] : t(`gaps.net_${r.kind}`)}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-4 hidden w-full sm:block" role="img" aria-label={t("gaps.netAria", { path: chosen.steps.join(" → ") })}>
        {(["now", "bridge", "goal"] as const).map((c, i) => (
          <text key={c} x={COL[i]} y={18} textAnchor="middle" className="fill-current text-[11px] font-semibold tracking-[0.12em] uppercase opacity-60">
            {t(`gaps.netCol_${c}`)}
          </text>
        ))}
        {routes
          .filter((r) => r.id !== chosen.id)
          .flatMap((r) => edges(r).map((e, i) => <path key={`${r.id}-${i}`} d={curve(e[0], e[1])} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1.5" strokeDasharray="4 5" />))}
        {edges(chosen).map((e, i) => (
          <path key={`c-${i}`} d={curve(e[0], e[1])} fill="none" stroke="var(--color-signal)" strokeWidth="3" />
        ))}
        {[...pos.entries()].map(([key, [x, yy]]) => {
          const col = Number(key[0]);
          const name = key.slice(2);
          const on = onChosen(col, name);
          return (
            <g key={key}>
              <circle cx={x} cy={yy} r={on ? 15 : 11} fill={on ? "var(--color-signal)" : "currentColor"} fillOpacity={on ? 1 : 0.18} />
              {on && (
                <text x={x} y={yy + 4} textAnchor="middle" className="fill-[#0e1f2f] text-[11px] font-bold">
                  {col + 1}
                </text>
              )}
              {lines(name).map((l, i) => (
                <text key={i} x={x} y={yy + 32 + i * 14} textAnchor="middle" className={`fill-current text-[12px] ${on ? "font-semibold" : "opacity-70"}`}>
                  {l}
                </text>
              ))}
            </g>
          );
        })}
      </svg>

      {/* Phones: the chosen route as steps. */}
      <ol className="mt-4 flex flex-col gap-2 sm:hidden">
        {chosen.steps.map((s, i) => (
          <li key={s} className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-signal text-xs font-bold text-ink">{i + 1}</span>
            <span className="font-medium">{s}</span>
          </li>
        ))}
      </ol>

      <h3 className="mt-5 text-xs font-semibold tracking-[0.12em] uppercase opacity-70">{t("gaps.netInfo")}</h3>
      <ul className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {routes.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => setSel(r.id)}
              className={`h-full w-full cursor-pointer rounded-xl p-3 text-start text-sm ${r.id === chosen.id ? "bg-white/[0.12] ring-1 ring-signal" : "bg-white/[0.06] hover:bg-white/10"}`}
            >
              <span className="block font-semibold">{r.kind === "nearby" ? r.steps[r.steps.length - 1] : t(`gaps.net_${r.kind}`)}</span>
              <span className="mt-0.5 block text-xs text-[#c9d2de]">{r.steps.join(" → ")}</span>
              {r.carries.length > 0 && (
                <span className="mt-1.5 block text-xs text-[#dfe5ec]">{t("gaps.netOverlap", { n: r.overlap, have: r.have.length, total: r.carries.length })}</span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {chosen.carries.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5" aria-label={t("gaps.netCarries")}>
          {chosen.carries.map((c) => {
            const has = chosen.have.includes(c);
            return (
              <li key={c} className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${has ? "bg-signal/25 text-paper" : "bg-white/[0.06] text-[#c9d2de]"}`}>
                {has && <Check aria-hidden="true" className="size-3.5" />}
                {c}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
