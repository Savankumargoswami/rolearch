import type { Metadata } from "next";

// Google shows about 60 characters of a title in results and cuts the rest. The site adds " · Rolearch" (11
// characters) to every title; long titles drop that suffix and, if still too long, shorten their first part at a word.
const MAX = 62;
const SUFFIX = " · Rolearch".length;

/** Cuts text to at most `max` characters at a word boundary, with an ellipsis when it cut. */
export function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  const at = cut.lastIndexOf(" ");
  return `${(at > max * 0.5 ? cut.slice(0, at) : cut).replace(/[\s,;:–—-]+$/, "")}…`;
}

/**
 * A page title that fits in search results: `main` (+ " · Rolearch" when there's room). `tail` is kept whole and
 * `main` shortened first, e.g. a job title before " at Company".
 */
export function fitTitle(main: string, tail = ""): Metadata["title"] {
  const full = `${main}${tail}`;
  if (full.length + SUFFIX <= MAX) return full;
  if (full.length <= MAX) return { absolute: full };
  const t = tail.length > MAX / 2 ? clip(tail, Math.floor(MAX / 2)) : tail;
  return { absolute: `${clip(main, MAX - t.length)}${t}` };
}

/**
 * Postings that aren't a job: a "join our talent community" sign-up or a general application. Google's job-posting
 * guidelines exclude them, so their pages carry no job listing data and aren't indexed (db/056 keeps them out of the
 * sitemaps with the same pattern).
 */
export const notARealJob = (title: string) =>
  /(talent (community|pool|network)|general application|open application|expression of interest|future opportunit|join our team)/i.test(title);
