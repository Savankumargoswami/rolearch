import { BadgeCheck, Camera, Clock, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { LEVELS, SKILLS, levelName, retryLabel, skillName } from "@/lib/skill-tests";
import { createClient } from "@/lib/supabase/server";
import { SkillPicker, type SkillOption } from "./skill-picker";

export const metadata: Metadata = {
  alternates: { canonical: "/skills" },
  title: t("skills.title"),
  description: "Proctored, auto-graded skill tests across tech, data, cloud, finance, business and clinical research. Pass with 90% to earn a verified badge.",
};

export default function SkillsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("skills.title")}</h1>
      <p className="mt-2 max-w-2xl text-muted">{t("skills.lead")}</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {[
          [Clock, t("skills.how1")],
          [Camera, t("skills.how2")],
          [BadgeCheck, t("skills.how3")],
          [Lock, t("skills.how4")],
        ].map(([Icon, text], i) => {
          const I = Icon as typeof Clock;
          return (
            <li key={i} className="flex gap-3 rounded-2xl border border-line bg-surface p-4 text-sm">
              <I aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-signal-ink" />
              <span>{text as string}</span>
            </li>
          );
        })}
      </ul>
      <Suspense fallback={<div className="mt-10 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Picker />
      </Suspense>
    </div>
  );
}

type Row = { id: string; skill: string; level: string; status: string; score: number | null; passed: boolean | null; submitted_at: string | null; started_at: string };

async function Picker() {
  const viewer = await loadViewer();
  let attempts: Row[] = [];
  if (viewer) {
    const db = await createClient();
    const { data } = await db
      .from("skill_attempts")
      .select("id,skill,level,status,score,passed,submitted_at,started_at")
      .eq("user_id", viewer.id)
      .order("started_at", { ascending: false });
    attempts = (data ?? []) as Row[];
  }
  const skills: SkillOption[] = SKILLS.map((s) => ({
    id: s.id,
    name: s.name,
    levels: LEVELS.map((l) => {
      const mine = attempts.filter((a) => a.skill === s.id && a.level === l.id);
      const pass = mine.find((a) => a.passed);
      const last = mine[0];
      const base = { id: l.id, name: l.name, retryLabel: null as string | null };
      if (pass) return { ...base, state: "passed" as const, score: Number(pass.score), attemptId: pass.id };
      if (last?.status === "in_progress") return { ...base, state: "in_progress" as const, score: null, attemptId: last.id };
      const wait = last ? retryLabel(last.submitted_at) : null;
      if (last && wait) return { ...base, state: "cooling" as const, score: Number(last.score ?? 0), attemptId: last.id, retryLabel: wait };
      if (last) return { ...base, state: "retake" as const, score: Number(last.score ?? 0), attemptId: last.id };
      return { ...base, state: "new" as const, score: null, attemptId: null };
    }),
  }));
  const passed = attempts.filter((a) => a.passed);
  // Open on the skill of a test that's still running, if there is one.
  const running = attempts.find((a) => a.status === "in_progress");
  return (
    <>
      {passed.length > 0 && (
        <section aria-labelledby="mine-h" className="mt-10">
          <h2 id="mine-h" className="font-display text-lg font-semibold">
            {t("skills.yourBadges")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2">
            {passed.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/skills/result/${a.id}`}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-sm hover:bg-ink-soft"
                >
                  <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
                  {skillName(a.skill)} · {levelName(a.level)}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <SkillPicker skills={skills} signedIn={!!viewer} initialSkill={running?.skill ?? SKILLS[0].id} />
    </>
  );
}
