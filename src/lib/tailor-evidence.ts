// Evidence-based resume tailoring: every suggested edit must rest on something the resume already shows (or a skill
// the person confirmed). Edits that bring in a skill with no evidence are undone and turned into a question instead,
// and the person can keep their original line for any edit. Pure functions, used on the server and in the browser.
import type { AtsDoc } from "./ats-doc";
import { mentions } from "./skills";

export type EvidenceChange = { section: string; before: string; after: string; why: string; requirement?: string };

/** Job keywords an edit adds that the original resume never shows and the person hasn't confirmed. */
export function unsupported(change: EvidenceChange, originalText: string, keywords: string[], confirmed: string[]): string[] {
  const ok = new Set(confirmed.map((c) => c.toLowerCase()));
  return keywords.filter((k) => !ok.has(k.toLowerCase()) && mentions(k, change.after) > 0 && mentions(k, change.before) === 0 && mentions(k, originalText) === 0);
}

/** The resume with one edit undone: wherever the edited text appears, the original comes back. */
export function keepOriginal(doc: AtsDoc, change: EvidenceChange): AtsDoc {
  return replaceText(doc, change.after, change.before);
}

/** The resume with one line of text (headline, summary, a bullet or a project summary) replaced by another. */
export function replaceText(doc: AtsDoc, from: string, to: string): AtsDoc {
  if (!from || from === to) return doc;
  const swap = (s: string) => (s === from ? to : s);
  const r = doc.resume;
  return {
    ...doc,
    headline: swap(doc.headline),
    summary: doc.summary === undefined ? doc.summary : swap(doc.summary),
    resume: {
      ...r,
      experience: r.experience.map((e) => ({ ...e, bullets: e.bullets.map(swap).filter((b) => b !== "") })),
      projects: r.projects.map((p) => ({ ...p, summary: swap(p.summary) })),
    },
  };
}

/** The resume with every edit the person chose to keep original undone. */
export function applyChoices(doc: AtsDoc, changes: EvidenceChange[], keep: Set<number>): AtsDoc {
  return changes.reduce((d, c, i) => (keep.has(i) ? keepOriginal(d, c) : d), doc);
}
