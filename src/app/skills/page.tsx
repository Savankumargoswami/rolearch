import { BadgeCheck, Camera, Clock, Lock, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { LEVELS, RETRY_HOURS, SKILLS } from "@/lib/skill-tests";
import { createClient } from "@/lib/supabase/server";
import { StartButton } from "./start-button";

export const metadata: Metadata = {
  title: t("skills.title"),
  description: "Proctored, auto-graded skill tests for Python, SQL, Excel, Statistics, AWS and React. Pass with 90% to earn a verified badge.",
};

export default function SkillsPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
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
        <SkillGrid />
      </Suspense>
    </div>
  );
}

type Row = { id: string; skill: string; level: string; status: string; score: number | null; passed: boolean | null; submitted_at: string | null; started_at: string };

async function SkillGrid() {
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
  const latest = (skill: string, level: string) => attempts.find((a) => a.skill === skill && a.level === level);
  const passedRow = (skill: string, level: string) => attempts.find((a) => a.skill === skill && a.level === level && a.passed);

  return (
    <div className="mt-10 grid gap-5 md:grid-cols-2">
      {SKILLS.map((s) => (
        <section key={s.id} aria-labelledby={`skill-${s.id}`} className="rounded-3xl border border-line bg-surface p-5">
          <h2 id={`skill-${s.id}`} className="flex items-center gap-2 font-display text-xl font-semibold">
            <ShieldCheck aria-hidden="true" className="size-5 text-signal-ink" />
            {s.name}
          </h2>
          <ul className="mt-4 divide-y divide-line">
            {LEVELS.map((l) => {
              const pass = passedRow(s.id, l.id);
              const last = latest(s.id, l.id);
              const retry = last?.submitted_at ? new Date(new Date(last.submitted_at).getTime() + RETRY_HOURS * 3600_000) : null;
              const cooling = !pass && last?.status !== "in_progress" && retry && retry.getTime() > Date.now();
              return (
                <li key={l.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-sm text-muted">
                      {pass
                        ? t("skills.passed", { score: Math.round(Number(pass.score)) })
                        : last?.status === "graded"
                          ? t("skills.lastScore", { score: Math.round(Number(last.score)) })
                          : t("skills.notTaken")}
                    </p>
                  </div>
                  {pass ? (
                    <Link href={`/skills/result/${pass.id}`} className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line px-4 text-sm hover:bg-ink-soft">
                      <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
                      {t("skills.viewAnswers")}
                    </Link>
                  ) : !viewer ? (
                    <Link href="/signin?next=/skills" className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm hover:bg-ink-soft">
                      {t("skills.signInToStart")}
                    </Link>
                  ) : cooling ? (
                    <span className="text-sm text-muted">
                      {t("skills.retryAt", { when: retry!.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) })}
                    </span>
                  ) : (
                    <StartButton skill={s.id} level={l.id} skillName={s.name} levelName={l.name} resume={last?.status === "in_progress"} />
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
