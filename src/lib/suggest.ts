// Search-as-you-type terms: common role titles, skills and companies. Kept small
// (a few KB) so the home page doesn't ship the whole job index.
import feedSuggest from "@/data/feed-suggest.json";
import { sampleJobs } from "@/data/sample-jobs";

const pool: string[] =
  feedSuggest.terms.length > 0
    ? feedSuggest.terms
    : Array.from(new Set([...sampleJobs.map((j) => j.title), ...sampleJobs.flatMap((j) => j.skills), ...sampleJobs.map((j) => j.company)]));

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const folded = pool.map((term) => [term, fold(term)] as const);

export function suggest(q: string, limit = 6): string[] {
  const needle = fold(q.trim());
  if (!needle) return [];
  const starts = folded.filter(([, f]) => f.startsWith(needle) && f !== needle).map(([t]) => t);
  const contains = folded.filter(([, f]) => !f.startsWith(needle) && f.includes(needle)).map(([t]) => t);
  return [...starts, ...contains].slice(0, limit);
}
