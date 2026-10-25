// Does a hiring post fit a member? The role's words (by stem) appear in their headline or job titles, and the
// place works: remote, the same state, or no place given. Deterministic, so it's cheap to run on every feed load.
import "server-only";
import type { Hiring } from "./post-review";
import type { ProfileData } from "./profile-schema";
import { place } from "./screening";
import { count, stemmed } from "./stem";

// Words that say nothing about the job itself.
const GENERIC = new Set(["senior", "sr", "junior", "jr", "lead", "staff", "principal", "head", "of", "and", "the", "a", "i", "ii", "iii", "intern", "level"]);

export function matchesProfile(h: Hiring | null | undefined, p: ProfileData | null): boolean {
  if (!h?.role || !p) return false;
  const words = h.role.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w && !GENERIC.has(w));
  if (!words.length) return false;
  const mine = stemmed([p.headline, ...p.resume.experience.map((e) => e.title)].join("\n"));
  if (!words.every((w) => count(w, mine) > 0)) return false;
  if (h.workplace === "remote" || !h.location || /remote/i.test(h.location)) return true;
  const want = place(h.location);
  const have = place(p.location);
  return !want.state || !have.state || want.state === have.state;
}
