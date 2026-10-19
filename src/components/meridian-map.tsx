import type { MapPin } from "@/data/db";
import { t } from "@/i18n";

const W = 1200;
const H = 440;
const LAT_TOP = 66;
const LAT_SPAN = 110; // 66°N to 44°S
const x = (lon: number) => ((lon + 180) / 360) * W;
const y = (lat: number) => ((LAT_TOP - lat) / LAT_SPAN) * H;
const nf = new Intl.NumberFormat("en");
const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

/** The busiest cities whose labels don't overlap on the map. */
function labelled(pins: MapPin[], max = 12): Set<MapPin> {
  const out = new Set<MapPin>();
  const placed: { x: number; y: number }[] = [];
  for (const p of [...pins].sort((a, b) => b.n - a.n)) {
    const px = x(p.lon);
    const py = y(p.lat);
    if (placed.every((q) => Math.abs(q.x - px) > 150 || Math.abs(q.y - py) > 46)) {
      out.add(p);
      placed.push({ x: px, y: py });
    }
    if (out.size >= max) break;
  }
  return out;
}

/**
 * A map with no coastlines: meridians, a few parallels, and a pin per city sized by its open roles.
 * The busiest cities carry their name and job count. Lines draw in once, then pins land west to east.
 */
export function MeridianMap({ pins }: { pins: MapPin[] }) {
  const max = Math.max(1, ...pins.map((p) => p.n));
  const labels = labelled(pins);
  const total = pins.reduce((s, p) => s + p.n, 0);
  const top = [...pins].sort((a, b) => b.n - a.n).slice(0, 10);
  const meridians = Array.from({ length: 13 }, (_, i) => -180 + i * 30);
  const parallels = [60, 30, 0, -30];
  const ordered = [...pins].sort((a, b) => a.lon - b.lon);

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="map-title map-desc" className="h-auto w-full overflow-visible">
        <title id="map-title">{t("globe.caption")}</title>
        <desc id="map-desc">{top.map((p) => `${p.city}: ${nf.format(p.n)}`).join(", ")}</desc>
        <g stroke="var(--color-line)" strokeWidth="1" fill="none">
          {meridians.map((lon, i) => (
            <line key={lon} className="draw" style={{ "--len": H, "--delay": `${i * 40}ms` } as React.CSSProperties} x1={x(lon)} y1={0} x2={x(lon)} y2={H} />
          ))}
          {parallels.map((lat, i) => (
            <line
              key={lat}
              className="draw"
              style={{ "--len": W, "--delay": `${200 + i * 60}ms` } as React.CSSProperties}
              x1={0}
              y1={y(lat)}
              x2={W}
              y2={y(lat)}
              strokeDasharray={lat === 0 ? "2 6" : undefined}
            />
          ))}
        </g>
        {ordered.map((p, i) => (
          <g key={`${p.city}-${p.lat}-${p.lon}`} className="pin-in" style={{ "--delay": `${700 + Math.min(i * 12, 900)}ms` } as React.CSSProperties}>
            <title>{`${p.city}, ${p.country}: ${nf.format(p.n)} ${t("globe.jobs")}`}</title>
            <circle className="pin-halo" cx={x(p.lon)} cy={y(p.lat)} r={6 + 22 * Math.sqrt(p.n / max)} fill="var(--color-signal)" opacity="0.28" />
            <circle className="pin-dot" cx={x(p.lon)} cy={y(p.lat)} r={labels.has(p) ? 5 : 3.5} fill="var(--color-ink)" />
          </g>
        ))}
        {/* Labels on top of every pin, with a paper-coloured outline so they stay readable over halos and lines. */}
        <g className="hidden md:block" aria-hidden="true">
          {ordered
            .filter((p) => labels.has(p))
            .map((p) => {
              const below = p.lat < 15;
              const ly = y(p.lat) + (below ? 34 : -22);
              return (
                <text
                  key={`label-${p.city}-${p.lat}`}
                  x={x(p.lon)}
                  y={ly}
                  textAnchor="middle"
                  className="pin-in fill-ink font-sans"
                  style={{ paintOrder: "stroke", stroke: "var(--color-paper)", strokeWidth: 6, strokeLinejoin: "round", "--delay": "1300ms" } as React.CSSProperties}
                >
                  <tspan className="text-[19px] font-semibold">{p.city}</tspan>
                  <tspan className="fill-signal-ink text-[17px] font-semibold tabular-nums" dx="8">
                    {compact.format(p.n)}
                  </tspan>
                </text>
              );
            })}
        </g>
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-sm text-muted">
        <span>{t("globe.caption")}</span>
        {total > 0 && <span className="tabular-nums">{t("globe.total", { n: nf.format(total), c: nf.format(pins.length) })}</span>}
      </figcaption>

      {top.length > 0 && (
        <div className="mt-4">
          <p className="text-sm font-semibold">{t("globe.topCities")}</p>
          <ul className="rail -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
            {top.map((p) => (
              <li key={`top-${p.city}-${p.lat}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                <span aria-hidden="true" className="size-2 rounded-full bg-signal" />
                <span className="font-medium">{p.city}</span>
                <span className="tabular-nums text-muted">{nf.format(p.n)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </figure>
  );
}
