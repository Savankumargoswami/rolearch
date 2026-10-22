// Turns what people type ("remote data engineering manager jobs near me", "nurse jobs in phoenix with visa
// sponsorship", "remote jobs in india") into search words plus filters. Filler words are dropped so they don't have
// to match a title.

import { takeCountry } from "./countries-query";

export type ParsedQuery = {
  text: string;
  remote: boolean;
  visa: boolean;
  nearMe: boolean;
  entry: boolean;
  /** A country named in the query, as an ISO code plus its name ("IN", "India"). */
  country: { code: string; name: string } | null;
  found: string[];
};

const PHRASES: { re: RegExp; set: "remote" | "visa" | "nearMe" | "entry"; label: string }[] = [
  // includes common misspellings of "remote"
  { re: /\b(work(ing)? from home|wfh|fully remote|remote[- ]first|remote|remot|reomte|remtoe|remoet|remte|telecommute|telework)\b/gi, set: "remote", label: "remote" },
  { re: /\b(visa sponsorship|sponsors? visas?|h-?1b|visa|sponsorship)\b/gi, set: "visa", label: "visa" },
  { re: /\b(near me|nearby|close to me|around me|in my area|near my location)\b/gi, set: "nearMe", label: "nearMe" },
  { re: /\b(entry[- ]level|no experience|new grads?|fresh(er)?s?|graduate roles?)\b/gi, set: "entry", label: "entry" },
];

// Words that describe the search itself, not the job.
const FILLER = new Set([
  "job", "jobs", "role", "roles", "position", "positions", "opening", "openings", "vacancy", "vacancies", "career", "careers",
  "opportunity", "opportunities", "hiring", "employment", "in", "at", "near", "for", "the", "a", "an", "with", "and", "or",
  "to", "around", "based", "area", "now", "any", "available", "looking", "find", "show", "me", "i", "im", "want", "need",
  "please", "open", "current", "currently", "within", "from", "of", "country", "anywhere",
]);

export function parseQuery(raw: string): ParsedQuery {
  let s = ` ${raw.toLowerCase()} `;
  const out: ParsedQuery = { text: "", remote: false, visa: false, nearMe: false, entry: false, country: null, found: [] };
  for (const p of PHRASES) {
    if (p.re.test(s)) {
      out[p.set] = true;
      out.found.push(p.label);
      s = s.replace(p.re, " ");
    }
    p.re.lastIndex = 0;
  }
  const { country, rest } = takeCountry(s);
  if (country) {
    out.country = country;
    out.found.push("country");
    s = ` ${rest} `;
  }
  const words = s
    .split(/[\s,;/|]+/)
    .map((w) => w.replace(/^[^\p{L}\p{N}+#]+|[^\p{L}\p{N}+#]+$/gu, ""))
    .filter((w) => w && !FILLER.has(w));
  out.text = words.join(" ").slice(0, 100);
  return out;
}
