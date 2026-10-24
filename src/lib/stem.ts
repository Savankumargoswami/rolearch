// Keyword matching the way resume scanners do it: words are reduced to their stems (Porter's algorithm), so
// "decision" meets "decisive" and "statistical" meets "statistics", but a phrase only counts when all of its words
// appear together, in order ("machine learning" doesn't count for "machine learning algorithms").

const STEP2: [string, string][] = [
  ["ational", "ate"], ["tional", "tion"], ["enci", "ence"], ["anci", "ance"], ["izer", "ize"], ["bli", "ble"], ["alli", "al"],
  ["entli", "ent"], ["eli", "e"], ["ousli", "ous"], ["ization", "ize"], ["ation", "ate"], ["ator", "ate"], ["alism", "al"],
  ["iveness", "ive"], ["fulness", "ful"], ["ousness", "ous"], ["aliti", "al"], ["iviti", "ive"], ["biliti", "ble"], ["logi", "log"],
];
const STEP3: [string, string][] = [["icate", "ic"], ["ative", ""], ["alize", "al"], ["iciti", "ic"], ["ical", "ic"], ["ful", ""], ["ness", ""]];
const STEP4 = ["al", "ance", "ence", "er", "ic", "able", "ible", "ant", "ement", "ment", "ent", "ou", "ism", "ate", "iti", "ous", "ive", "ize"];

const isCons = (w: string, i: number): boolean => {
  const c = w[i];
  if ("aeiou".includes(c)) return false;
  if (c === "y") return i === 0 ? true : !isCons(w, i - 1);
  return true;
};
/** m(): the number of vowel-consonant sequences in a stem. */
function measure(s: string): number {
  let n = 0;
  let i = 0;
  const len = s.length;
  while (i < len && isCons(s, i)) i++;
  while (i < len) {
    while (i < len && !isCons(s, i)) i++;
    if (i >= len) break;
    n++;
    while (i < len && isCons(s, i)) i++;
  }
  return n;
}
const hasVowel = (s: string) => [...s].some((_, i) => !isCons(s, i));
const doubleCons = (s: string) => s.length > 1 && s[s.length - 1] === s[s.length - 2] && isCons(s, s.length - 1);
const cvc = (s: string) => {
  const l = s.length;
  return l >= 3 && isCons(s, l - 3) && !isCons(s, l - 2) && isCons(s, l - 1) && !"wxy".includes(s[l - 1]);
};

/** Porter stemmer (1980), for lower-case English words. */
export function stem(word: string): string {
  let w = word;
  if (w.length < 3 || !/^[a-z]+$/.test(w)) return w;
  // 1a
  if (w.endsWith("sses")) w = w.slice(0, -2);
  else if (w.endsWith("ies")) w = w.slice(0, -2);
  else if (!w.endsWith("ss") && w.endsWith("s")) w = w.slice(0, -1);
  // 1b
  let again = false;
  if (w.endsWith("eed")) {
    if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1);
  } else if (w.endsWith("ed") && hasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2);
    again = true;
  } else if (w.endsWith("ing") && hasVowel(w.slice(0, -3))) {
    w = w.slice(0, -3);
    again = true;
  }
  if (again) {
    if (w.endsWith("at") || w.endsWith("bl") || w.endsWith("iz")) w += "e";
    else if (doubleCons(w) && !"lsz".includes(w[w.length - 1])) w = w.slice(0, -1);
    else if (measure(w) === 1 && cvc(w)) w += "e";
  }
  // 1c
  if (w.endsWith("y") && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + "i";
  // 2, 3
  for (const table of [STEP2, STEP3]) {
    for (const [suf, rep] of table) {
      if (w.endsWith(suf)) {
        const base = w.slice(0, -suf.length);
        if (measure(base) > 0) w = base + rep;
        break;
      }
    }
  }
  // 4
  for (const suf of STEP4) {
    if (w.endsWith(suf)) {
      const base = w.slice(0, -suf.length);
      if (measure(base) > 1) w = base;
      break;
    }
  }
  if (w.endsWith("ion")) {
    const base = w.slice(0, -3);
    if (measure(base) > 1 && (base.endsWith("s") || base.endsWith("t"))) w = base;
  }
  // 5
  if (w.endsWith("e")) {
    const base = w.slice(0, -1);
    const m = measure(base);
    if (m > 1 || (m === 1 && !cvc(base))) w = base;
  }
  if (measure(w) > 1 && doubleCons(w) && w.endsWith("l")) w = w.slice(0, -1);
  return w;
}

/** Words as a scanner sees them: lower case, split on anything but letters and digits ("C++" and "C#" kept). */
export function tokens(text: string): string[] {
  return (text.toLowerCase().replace(/&/g, " and ").match(/[a-z0-9]+(?:\+\+|#)?/g) ?? []).map(stem);
}

/** Stemmed text, ready to count many phrases in. */
export type Stemmed = { words: string[] };
export const stemmed = (text: string): Stemmed => ({ words: tokens(text) });

/** How many times a phrase appears (all its words together, in order). */
export function count(phrase: string, text: Stemmed): number {
  const p = tokens(phrase);
  if (!p.length) return 0;
  const w = text.words;
  let n = 0;
  outer: for (let i = 0; i + p.length <= w.length; i++) {
    for (let j = 0; j < p.length; j++) if (w[i + j] !== p[j]) continue outer;
    n++;
  }
  return n;
}
