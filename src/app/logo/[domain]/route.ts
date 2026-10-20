import { NextResponse } from "next/server";

// A company's website icon, served from rolearch.com so visitors' browsers never contact a third party.
// Tries Google's favicon service (up to 128 px), then DuckDuckGo's (often a multi-size .ico), then the site's own
// apple-touch-icon (180 px when it allows it), keeps the largest, and answers 404 when nothing usable (at least
// 32 px) exists, so the page shows the initial instead.
// Responses are cached at the edge for 30 days.

const DOMAIN = /^(?=.{3,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/;
const MIN = 32;
const CACHE = "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=604800";

type Icon = { bytes: ArrayBuffer; type: string; size: number };

/** Pixel width of a PNG, or the largest image in an ICO; 0 when unknown. */
function iconSize(buf: ArrayBuffer): number {
  const b = new Uint8Array(buf);
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50) return (b[16] << 24) | (b[17] << 16) | (b[18] << 8) | b[19];
  if (b.length > 6 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) {
    const count = b[4] | (b[5] << 8);
    let best = 0;
    for (let i = 0; i < count && 6 + i * 16 < b.length; i++) best = Math.max(best, b[6 + i * 16] || 256);
    return best;
  }
  return 0;
}

async function get(url: string): Promise<Icon | null> {
  try {
    const res = await fetch(url, { redirect: "follow", signal: AbortSignal.timeout(6000), headers: { "User-Agent": "RolearchBot/0.1 (+https://rolearch.com/bot)" } });
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.startsWith("image/")) return null;
    const bytes = await res.arrayBuffer();
    if (bytes.byteLength < 100 || bytes.byteLength > 512_000) return null;
    return { bytes, type, size: iconSize(bytes) };
  } catch {
    return null;
  }
}

export async function GET(_: Request, { params }: { params: Promise<{ domain: string }> }) {
  const domain = decodeURIComponent((await params).domain).toLowerCase();
  if (!DOMAIN.test(domain)) return new NextResponse(null, { status: 400 });

  const google = await get(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
  let best = google;
  if (!google || google.size < 64) {
    const ddg = await get(`https://icons.duckduckgo.com/ip3/${domain}.ico`);
    if (ddg && ddg.size > (best?.size ?? 0)) best = ddg;
  }
  if (!best || best.size < 64) {
    for (const url of [`https://www.${domain}/apple-touch-icon.png`, `https://${domain}/apple-touch-icon.png`]) {
      const touch = await get(url);
      if (touch && touch.size > (best?.size ?? 0)) {
        best = touch;
        break;
      }
    }
  }
  if (!best || best.size < MIN) {
    return new NextResponse(null, { status: 404, headers: { "Cache-Control": "public, max-age=86400, s-maxage=604800" } });
  }
  return new NextResponse(best.bytes, { headers: { "Content-Type": best.type, "Cache-Control": CACHE, "X-Content-Type-Options": "nosniff" } });
}
