// Countries people type in a search ("remote jobs in india", "nurse in usa", "jobs in the uk", "indai"),
// with the ISO code the jobs table stores. Misspellings within one or two letters still match.

type Country = { code: string; name: string };

const NAMES: [string, string, string[]][] = [
  ["US", "United States", ["united states", "united states of america", "usa", "u.s.a", "u.s", "america", "the states"]],
  ["IN", "India", ["india", "bharat"]],
  ["GB", "United Kingdom", ["united kingdom", "uk", "u.k", "britain", "great britain", "england", "scotland", "wales", "northern ireland"]],
  ["CA", "Canada", ["canada"]],
  ["AU", "Australia", ["australia"]],
  ["NZ", "New Zealand", ["new zealand", "nz"]],
  ["DE", "Germany", ["germany", "deutschland"]],
  ["FR", "France", ["france"]],
  ["IE", "Ireland", ["ireland"]],
  ["NL", "Netherlands", ["netherlands", "holland"]],
  ["ES", "Spain", ["spain"]],
  ["IT", "Italy", ["italy"]],
  ["PT", "Portugal", ["portugal"]],
  ["PL", "Poland", ["poland"]],
  ["SE", "Sweden", ["sweden"]],
  ["CH", "Switzerland", ["switzerland"]],
  ["BE", "Belgium", ["belgium"]],
  ["AT", "Austria", ["austria"]],
  ["DK", "Denmark", ["denmark"]],
  ["NO", "Norway", ["norway"]],
  ["FI", "Finland", ["finland"]],
  ["CZ", "Czechia", ["czechia", "czech republic"]],
  ["RO", "Romania", ["romania"]],
  ["HU", "Hungary", ["hungary"]],
  ["GR", "Greece", ["greece"]],
  ["AE", "United Arab Emirates", ["united arab emirates", "uae", "dubai", "abu dhabi"]],
  ["SA", "Saudi Arabia", ["saudi arabia", "saudi", "ksa"]],
  ["QA", "Qatar", ["qatar"]],
  ["IL", "Israel", ["israel"]],
  ["SG", "Singapore", ["singapore"]],
  ["MY", "Malaysia", ["malaysia"]],
  ["PH", "Philippines", ["philippines"]],
  ["ID", "Indonesia", ["indonesia"]],
  ["TH", "Thailand", ["thailand"]],
  ["VN", "Vietnam", ["vietnam", "viet nam"]],
  ["JP", "Japan", ["japan"]],
  ["KR", "South Korea", ["south korea", "korea"]],
  ["CN", "China", ["china"]],
  ["HK", "Hong Kong", ["hong kong"]],
  ["TW", "Taiwan", ["taiwan"]],
  ["PK", "Pakistan", ["pakistan"]],
  ["BD", "Bangladesh", ["bangladesh"]],
  ["LK", "Sri Lanka", ["sri lanka"]],
  ["NP", "Nepal", ["nepal"]],
  ["MX", "Mexico", ["mexico"]],
  ["BR", "Brazil", ["brazil", "brasil"]],
  ["AR", "Argentina", ["argentina"]],
  ["CL", "Chile", ["chile"]],
  ["CO", "Colombia", ["colombia"]],
  ["CR", "Costa Rica", ["costa rica"]],
  ["ZA", "South Africa", ["south africa"]],
  ["NG", "Nigeria", ["nigeria"]],
  ["KE", "Kenya", ["kenya"]],
  ["EG", "Egypt", ["egypt"]],
];

const EXACT = new Map<string, Country>();
for (const [code, name, aliases] of NAMES) for (const a of aliases) EXACT.set(a, { code, name });
// Longest names first, so "united states of america" wins over "united states" and "america".
const PHRASES = [...EXACT.keys()].sort((a, b) => b.length - a.length);
// Single words long enough to recognise with one typo ("indai", "germny", "austrlia"). Short ones need to be exact,
// and words a typo away from ordinary job words aren't guessed ("sales" is not "wales", "media" is not "india").
const NOT_COUNTRIES = new Set(["sales", "media", "chief", "polish", "indie", "korean", "indian", "chinese", "portland"]);
const FUZZY = [...EXACT.keys()].filter((a) => !a.includes(" ") && !a.includes(".") && a.length >= 5 && a !== "wales");

function editDistance(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      // a swap of two neighbouring letters counts as one typo ("inida")
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Finds a country in the query and returns it with the query minus the country words. */
export function takeCountry(s: string): { country: Country | null; rest: string } {
  for (const p of PHRASES) {
    // "us" alone is too common a word; only "in (the) us" counts.
    const re = p === "u.s" ? /\b(in|from)( the)? u\.?s\.?(?=\s|$)/i : new RegExp(`(^|\\s)(in |from |the )?${escape(p)}(?=\\s|$)`, "i");
    if (re.test(s)) return { country: EXACT.get(p)!, rest: s.replace(re, " ") };
  }
  if (/\b(in|from)( the)? us\b/i.test(s)) return { country: EXACT.get("usa")!, rest: s.replace(/\b(in|from)( the)? us\b/i, " ") };
  const words = s.split(/\s+/);
  for (let i = 0; i < words.length; i++) {
    const w = words[i].replace(/[^a-z]/g, "");
    if (w.length < 5 || NOT_COUNTRIES.has(w)) continue;
    const hit = FUZZY.find((a) => Math.abs(a.length - w.length) <= 1 && editDistance(a, w) <= 1);
    if (hit) return { country: EXACT.get(hit)!, rest: words.filter((_, k) => k !== i).join(" ") };
  }
  return { country: null, rest: s };
}
