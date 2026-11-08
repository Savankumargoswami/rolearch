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

/** A skill the person says they have, with where they used it and what they did, in their own words. */
export type SkillEvidence = { skill: string; place: string; line: string };

/** Why a skill claim can't be accepted yet, or "" when it's specific enough to go on a resume. */
export function evidenceProblem(skill: string, line: string): "" | "short" | "name" {
  const text = line.trim();
  if (text.split(/\s+/).length < 6) return "short";
  if (mentions(skill, text) === 0) return "name";
  return "";
}

/**
 * The resume with each confirmed skill written into the role or project where the person used it, as their own
 * line. Tailoring may then use the skill, because the resume now shows where it comes from. `place` is "exp:<i>"
 * or "proj:<i>"; anything else lands in the most recent role.
 */
export function withEvidence(doc: AtsDoc, evidence: SkillEvidence[]): AtsDoc {
  if (!evidence.length) return doc;
  const r = doc.resume;
  const experience = r.experience.map((e) => ({ ...e, bullets: [...e.bullets] }));
  const projects = r.projects.map((p) => ({ ...p, skills: [...p.skills] }));
  for (const ev of evidence) {
    const line = ev.line.trim().replace(/\s+/g, " ").slice(0, 400);
    const [kind, n] = ev.place.split(":");
    const i = Number(n);
    if (kind === "proj" && projects[i]) {
      projects[i].summary = projects[i].summary ? `${projects[i].summary} ${line}` : line;
      if (!projects[i].skills.includes(ev.skill)) projects[i].skills.push(ev.skill);
    } else {
      const e = experience[kind === "exp" && experience[i] ? i : 0];
      // Roles hold up to 12 bullets: the person's own line goes in, the last one makes room.
      if (e && !e.bullets.includes(line)) e.bullets = [...e.bullets.slice(0, 11), line];
    }
  }
  return { ...doc, resume: { ...r, experience, projects } };
}

/**
 * What counts as evidence of a skill: the work itself (roles, their bullets, projects, certifications, education)
 * and skills verified by a Rolearch skill test. The skills list, skill groups, headline and summary are the person's
 * own claims, so a skill that appears only there can stay listed but is never written into a role or the summary.
 */
export function workEvidence(doc: AtsDoc, verified: string[] = []): string {
  const r = doc.resume;
  return [
    ...r.experience.flatMap((e) => [e.title, e.company, ...e.bullets]),
    ...r.projects.flatMap((p) => [p.name, p.summary]),
    ...r.certifications.map((c) => `${c.name} ${c.issuer}`),
    ...r.education.map((e) => `${e.degree} ${e.field} ${e.school}`),
    ...verified,
  ]
    .filter(Boolean)
    .join("\n");
}
