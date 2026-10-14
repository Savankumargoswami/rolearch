// Locale settings. To add a language: create messages/<code>.ts with the same
// shape as messages/en.ts, add it to `messages` in index.ts, and list it here.
export const locales = ["en"] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = "en";

// Languages written right to left. The layout uses logical properties
// (start/end), so adding one of these only needs its messages file.
const rtlLocales = new Set(["ar", "he", "fa", "ur"]);

export function dirFor(locale: string): "ltr" | "rtl" {
  return rtlLocales.has(locale.split("-")[0]) ? "rtl" : "ltr";
}
