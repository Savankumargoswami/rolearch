"use client";

import { BadgeCheck, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { t, type MessageKey } from "@/i18n";
import { StartButton } from "./start-button";

export type LevelStatus = {
  id: string;
  name: string;
  state: "passed" | "in_progress" | "cooling" | "retake" | "new";
  score: number | null;
  retryLabel: string | null;
  attemptId: string | null;
};
export type SkillOption = { id: string; name: string; levels: LevelStatus[] };

const HINT: Record<string, MessageKey> = { entry: "skills.levelEntry", mid: "skills.levelMid", senior: "skills.levelSenior", very_senior: "skills.levelVerySenior" };

/** Step 1: choose a skill from the list; step 2: choose a level (each shows where you stand); step 3: start, resume or view the result. */
export function SkillPicker({ skills, signedIn, initialSkill }: { skills: SkillOption[]; signedIn: boolean; initialSkill: string }) {
  const [skillId, setSkillId] = useState(initialSkill);
  const [levelId, setLevelId] = useState<string | null>(null);
  const skill = skills.find((s) => s.id === skillId) ?? skills[0];
  const level = skill.levels.find((l) => l.id === levelId) ?? null;

  return (
    <section className="mt-10 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 className="font-display text-lg font-semibold">{t("skills.step1")}</h2>
      <label htmlFor="skill-select" className="sr-only">
        {t("skills.skillLabel")}
      </label>
      <div className="relative mt-3">
        <select
          id="skill-select"
          value={skill.id}
          onChange={(e) => {
            setSkillId(e.target.value);
            setLevelId(null);
          }}
          className="min-h-12 w-full appearance-none rounded-xl border border-line bg-paper py-2 ps-4 pe-10 text-base font-medium"
        >
          {skills.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.levels.some((l) => l.state === "passed") ? " ✓" : ""}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" className="pointer-events-none absolute end-3 top-1/2 size-5 -translate-y-1/2 text-muted" />
      </div>

      <h2 className="mt-7 font-display text-lg font-semibold">{t("skills.step2")}</h2>
      <div role="radiogroup" aria-label={t("skills.step2")} className="mt-3 grid gap-3 sm:grid-cols-2">
        {skill.levels.map((l) => {
          const selected = l.id === levelId;
          return (
            <button
              key={l.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setLevelId(l.id)}
              className={`flex min-h-20 flex-col items-start rounded-2xl border p-4 text-start transition-colors ${
                selected ? "border-ink bg-ink-soft ring-1 ring-ink" : "border-line bg-paper hover:border-ink/40"
              }`}
            >
              <span className="flex w-full items-center justify-between gap-2 font-medium">
                {l.name}
                {l.state === "passed" && <BadgeCheck aria-label={t("skills.passedBadge")} className="size-5 text-signal-ink" />}
              </span>
              <span className="mt-0.5 text-sm text-muted">{t(HINT[l.id])}</span>
              <span className="mt-2 text-sm">
                {l.state === "passed"
                  ? t("skills.passed", { score: Math.round(l.score ?? 0) })
                  : l.state === "in_progress"
                    ? t("skills.resume")
                    : l.state === "cooling"
                      ? t("skills.retryAt", { when: l.retryLabel ?? "" })
                      : l.state === "retake"
                        ? t("skills.lastScore", { score: Math.round(l.score ?? 0) })
                        : t("skills.notTaken")}
              </span>
            </button>
          );
        })}
      </div>

      <h2 className="mt-7 font-display text-lg font-semibold">{t("skills.step3")}</h2>
      <div className="mt-3 flex min-h-12 flex-wrap items-center gap-3">
        {!level ? (
          <p className="text-sm text-muted">{t("skills.pickLevelFirst")}</p>
        ) : !signedIn ? (
          <Link href="/signin?next=/skills" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-hover">
            {t("skills.signInToStart")}
          </Link>
        ) : level.state === "passed" ? (
          <Link
            href={`/skills/result/${level.attemptId}`}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-5 text-sm hover:bg-ink-soft"
          >
            <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
            {t("skills.viewResult")}
          </Link>
        ) : level.state === "cooling" ? (
          <p className="text-sm text-muted">{t("skills.retryAt", { when: level.retryLabel ?? "" })}</p>
        ) : (
          <StartButton
            key={`${skill.id}-${level.id}`}
            skill={skill.id}
            level={level.id}
            skillName={skill.name}
            levelName={level.name}
            resume={level.state === "in_progress"}
          />
        )}
      </div>
    </section>
  );
}
