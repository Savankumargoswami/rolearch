import type { ProfileData } from "./profile-schema";

export type Expertise = { skill: string; months: number; source: "experience" | "projects" };

type Range = [start: number, end: number]; // months since year 0, inclusive

const toMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};

/** Each role's span in months; roles without a valid start are skipped. */
function roleRanges(profile: ProfileData, now: Date): { range: Range; skills: string[] }[] {
  const nowMonth = now.getUTCFullYear() * 12 + now.getUTCMonth();
  return profile.resume.experience.flatMap((role) => {
    const start = toMonth(role.start);
    const end = role.current || !role.end ? nowMonth : toMonth(role.end);
    return start == null || end == null || end < start ? [] : [{ range: [start, end] as Range, skills: role.skills }];
  });
}

/** Months covered by a set of ranges, overlaps counted once. */
function mergedMonths(ranges: Range[]): number {
  if (ranges.length === 0) return 0;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  let months = 0;
  let [start, end] = sorted[0];
  for (const [s, e] of sorted.slice(1)) {
    if (s <= end + 1) end = Math.max(end, e);
    else {
      months += end - start + 1;
      [start, end] = [s, e];
    }
  }
  return months + end - start + 1;
}

/**
 * Years per skill, counted from the dates of the roles that used it. Overlapping roles
 * count once, so two jobs at the same time don't double someone's experience. Skills
 * that only appear in projects come after, without years.
 */
export function expertiseOf(profile: ProfileData, now = new Date()): Expertise[] {
  const bySkill = new Map<string, { name: string; ranges: Range[] }>();
  for (const { range, skills } of roleRanges(profile, now)) {
    for (const skill of skills) {
      const key = skill.trim().toLowerCase();
      if (!key) continue;
      const entry = bySkill.get(key) ?? { name: skill.trim(), ranges: [] };
      entry.ranges.push(range);
      bySkill.set(key, entry);
    }
  }
  const out: Expertise[] = [...bySkill.values()]
    .map(({ name, ranges }) => ({ skill: name, months: mergedMonths(ranges), source: "experience" as const }))
    .sort((a, b) => b.months - a.months);

  const seen = new Set(out.map((e) => e.skill.toLowerCase()));
  for (const project of profile.resume.projects) {
    for (const skill of project.skills) {
      const key = skill.trim().toLowerCase();
      if (key && !seen.has(key)) {
        seen.add(key);
        out.push({ skill: skill.trim(), months: 0, source: "projects" });
      }
    }
  }
  return out;
}

/** Total time in work, overlapping roles counted once. */
export function totalMonths(profile: ProfileData, now = new Date()): number {
  return mergedMonths(roleRanges(profile, now).map((r) => r.range));
}

/** "4 yrs 7 mo", "8 mo", "1 yr" */
export function formatMonths(months: number): string {
  const y = Math.floor(months / 12);
  const m = months % 12;
  const parts = [];
  if (y) parts.push(`${y} ${y === 1 ? "yr" : "yrs"}`);
  if (m || !y) parts.push(`${m} mo`);
  return parts.join(" ");
}
