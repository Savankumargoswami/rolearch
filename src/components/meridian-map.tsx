import type { Job } from "@/data/types";
import { t } from "@/i18n";

// City coordinates [lat, lon] for the cities in the sample feed.
const coords: Record<string, [number, number]> = {
  Berlin: [52.5, 13.4], Singapore: [1.35, 103.8], London: [51.5, -0.13], Bengaluru: [12.97, 77.6],
  Toronto: [43.65, -79.4], Lisbon: [38.7, -9.1], "Bogotá": [4.7, -74.1], "São Paulo": [-23.55, -46.6],
  Dubai: [25.2, 55.3], Lagos: [6.5, 3.4], Tokyo: [35.7, 139.7], Sydney: [-33.9, 151.2],
  Amsterdam: [52.4, 4.9], Austin: [30.3, -97.7], "New York": [40.7, -74.0], Pune: [18.5, 73.9],
  Stockholm: [59.3, 18.1], "Cape Town": [-33.9, 18.4], "Mexico City": [19.4, -99.1], "Zürich": [47.4, 8.5],
  Seoul: [37.6, 127.0], Hyderabad: [17.4, 78.5], Warsaw: [52.2, 21.0],
};

// Labels go below the pin in the southern half, above it in the north.

const W = 1200;
const H = 440;
const LAT_TOP = 66;
const LAT_SPAN = 110; // 66°N to 44°S
const x = (lon: number) => ((lon + 180) / 360) * W;
const y = (lat: number) => ((LAT_TOP - lat) / LAT_SPAN) * H;

type Pin = { city: string; n: number; lat: number; lon: number };

/** Group jobs into one pin per city; label the busiest cities whose labels don't collide. */
function pinsFromJobs(jobs: Job[]): { pins: Pin[]; labels: Set<string> } {
  const byCity = new Map<string, Pin>();
  for (const j of jobs) {
    if (j.city === "Remote") continue;
    const lat = j.lat ?? coords[j.city]?.[0];
    const lon = j.lon ?? coords[j.city]?.[1];
    if (lat == null || lon == null) continue;
    const key = `${Math.round(lat * 2)}:${Math.round(lon * 2)}`;
    const pin = byCity.get(key);
    if (pin) pin.n += 1;
    else byCity.set(key, { city: j.city, n: 1, lat, lon });
  }
  const pins = [...byCity.values()].sort((a, b) => a.lon - b.lon);
  const labels = new Set<string>();
  const placed: { x: number; y: number }[] = [];
  for (const p of [...pins].sort((a, b) => b.n - a.n)) {
    const px = x(p.lon), py = y(p.lat);
    if (placed.every((q) => Math.abs(q.x - px) > 120 || Math.abs(q.y - py) > 34)) {
      labels.add(p.city);
      placed.push({ x: px, y: py });
    }
    if (labels.size >= 12) break;
  }
  return { pins, labels };
}

/**
 * A map with no coastlines: meridians, a few parallels, and a pin per city with open roles.
 * Lines draw in once, then pins land west to east, like the day moving across the world.
 */
export function MeridianMap({ jobs }: { jobs: Job[] }) {
  const { pins, labels } = pinsFromJobs(jobs);
  const max = Math.max(1, ...pins.map((p) => p.n));
  const meridians = Array.from({ length: 13 }, (_, i) => -180 + i * 30);
  const parallels = [60, 30, 0, -30];

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="map-title" className="h-auto w-full overflow-visible">
        <title id="map-title">{t("globe.caption")}</title>
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
        {pins.map((p, i) => {
          const isLabel = labels.has(p.city);
          const below = p.lat < 15;
          return (
            <g key={`${p.city}-${p.lat}`} className="pin-in" style={{ "--delay": `${700 + Math.min(i * 18, 900)}ms` } as React.CSSProperties}>
              <circle className="pin-halo" cx={x(p.lon)} cy={y(p.lat)} r={8 + 14 * Math.sqrt(p.n / max)} fill="var(--color-signal)" opacity="0.3" />
              <circle className="pin-dot" cx={x(p.lon)} cy={y(p.lat)} r={4.5} fill="var(--color-ink)" />
              {isLabel && (
                <text
                  x={x(p.lon)}
                  y={y(p.lat) + (below ? 28 : -16)}
                  textAnchor="middle"
                  className="hidden fill-ink font-sans text-[19px] md:block"
                >
                  {p.city}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-2 text-sm text-muted">{t("globe.caption")}</figcaption>
    </figure>
  );
}
