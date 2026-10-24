import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Checks a job feed a company wants to connect, before saving it: a public https address (redirects included),
// at most MAX_BYTES, and XML with jobs in a format the worker reads (Indeed-style <job>, RSS <item>, Atom <entry>).

const MAX_BYTES = 15_000_000;
const TIMEOUT_MS = 12_000;

export type FeedCheck = { ok: true; count: number } | { ok: false; reason: "address" | "unreachable" | "too_big" | "not_feed" | "empty" };

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const mapped = v.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? privateIp(mapped[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

export async function publicHttps(raw: string): Promise<URL | null> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" || url.username || url.password) return null;
  try {
    const addrs = await lookup(url.hostname, { all: true });
    return addrs.length && addrs.every((a) => !privateIp(a.address)) ? url : null;
  } catch {
    return null;
  }
}

export async function checkFeed(raw: string): Promise<FeedCheck> {
  let url = await publicHttps(raw.trim());
  if (!url) return { ok: false, reason: "address" };
  let res: Response | null = null;
  // Follow redirects by hand so each hop is checked too.
  for (let hop = 0; hop < 4; hop++) {
    try {
      res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(TIMEOUT_MS), headers: { "User-Agent": "RolearchBot/0.1 (+https://rolearch.com/bot)" } });
    } catch {
      return { ok: false, reason: "unreachable" };
    }
    const next = res.status >= 300 && res.status < 400 ? res.headers.get("location") : null;
    if (!next) break;
    url = await publicHttps(new URL(next, url).toString());
    if (!url) return { ok: false, reason: "address" };
  }
  if (!res || !res.ok || !res.body) return { ok: false, reason: "unreachable" };
  if (Number(res.headers.get("content-length") ?? 0) > MAX_BYTES) return { ok: false, reason: "too_big" };

  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return { ok: false, reason: "too_big" };
    }
    chunks.push(value);
  }
  const text = new TextDecoder().decode(Buffer.concat(chunks));
  const head = text.slice(0, 4096);
  if (!/^\s*(<\?xml|<)/.test(text) || /<!(DOCTYPE|ENTITY)/i.test(head)) return { ok: false, reason: "not_feed" };
  const count = (text.match(/<(job|item|entry)[\s>]/gi) ?? []).length;
  return count ? { ok: true, count } : { ok: false, reason: "empty" };
}
