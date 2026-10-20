// The /jobs URL for a search. Shared by the server page (pagination links) and the client controls.
import type { JobQuery } from "@/data/db";

export function toQueryString(f: JobQuery, page = 1): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.cat && f.cat !== "all") sp.set("cat", f.cat);
  if (f.where !== "anywhere") sp.set("where", f.where);
  if (f.remote) sp.set("remote", "1");
  if (f.visa) sp.set("visa", "1");
  if (f.pay) sp.set("pay", "1");
  if (f.level !== "any") sp.set("level", f.level);
  if (f.sort !== "match") sp.set("sort", f.sort);
  if (page > 1) sp.set("page", String(page));
  const s = sp.toString();
  return s ? `?${s}` : "";
}

/** search_jobs stops counting filtered matches at this many (db/013_fast_search.sql). */
export const COUNT_CAP = 10000;

/** "1,234", or "10,000+" when the count reached the cap. */
export function formatJobCount(n: number): string {
  const s = new Intl.NumberFormat("en").format(n);
  return n === COUNT_CAP ? `${s}+` : s;
}
