// Where the visitor is browsing from, approximately: Vercel derives the city from the connection on every
// request (x-vercel-ip-* headers). Used only to show nearby jobs first; never stored.
import "server-only";
import { headers } from "next/headers";

export type ViewerLocation = { lat: number; lon: number; label: string };

export async function viewerLocation(): Promise<ViewerLocation | null> {
  const h = await headers();
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lon = Number(h.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0) || !h.get("x-vercel-ip-latitude")) return null;
  const decode = (v: string | null) => {
    try {
      return v ? decodeURIComponent(v) : "";
    } catch {
      return v ?? "";
    }
  };
  const city = decode(h.get("x-vercel-ip-city"));
  const region = decode(h.get("x-vercel-ip-country-region"));
  const country = decode(h.get("x-vercel-ip-country"));
  const label = [city, country === "US" ? region : country].filter(Boolean).join(", ") || "your area";
  // Rounded to ~10 km: enough to rank nearby jobs, and it keeps search results shareable in the cache.
  return { lat: Math.round(lat * 10) / 10, lon: Math.round(lon * 10) / 10, label };
}
