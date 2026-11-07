import { ArrowUpRight, Check, Flag, Hammer, Map as MapIcon, Search, Telescope } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { JobRow } from "@/components/job-row";
import { t } from "@/i18n";
import { coreTitle } from "@/lib/ats";
import { careerGaps, type SkillGap, type Stage } from "@/lib/career-gaps";
import { summarize } from "@/lib/fit-list";
import { loadPreferences } from "@/lib/preferences";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { roadmapForTitle } from "@/lib/roadmaps";
import { transitionNetwork, transitionPath } from "@/lib/transitions";
import { PathNetwork } from "./path-network";

export const metadata: Metadata = { title: "Career gap-to-action roadmap", robots: { index: false } };

const STAGES: { id: Stage; icon: typeof Telescope }[] = [
  { id: "explore", icon: Telescope },
  { id: "learn", icon: MapIcon },
  { id: "experience", icon: Hammer },
  { id: "land", icon: Flag },
];

export default function GapsPage({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("gaps.eyebrow")}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-5xl">{t("gaps.title")}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t("gaps.lead")}</p>
      <Suspense fallback={<div className="mt-8 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Gaps searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

const level = (n: number) => (n >= 80 ? "advanced" : n >= 45 ? "intermediate" : n > 0 ? "beginner" : "none");

async function Gaps({ searchParams }: { searchParams: Promise<{ role?: string }> }) {
  const { role: asked } = await searchParams;
  const viewer = await requireMember(`/gaps${asked ? `?role=${encodeURIComponent(asked)}` : ""}`);
  const p = viewer.profile;
  const current = p.resume.experience.find((e) => e.current) ?? p.resume.experience[0];
  const prefs = await loadPreferences(await createClient());
  const role = (asked ?? "").trim().slice(0, 80) || prefs.targetRoles[0] || coreTitle(current?.title ?? "") || coreTitle(p.headline);
  const form = (
    <form action="/gaps" className="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-end">
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">{t("gaps.roleLabel")}</span>
        <input name="role" defaultValue={role} placeholder={t("discover.rolePlaceholder")} maxLength={80} className="h-11 rounded-xl border border-line bg-paper/40 px-3 text-[0.95rem]" />
      </label>
      <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
        <Search aria-hidden="true" className="size-4" />
        {t("gaps.build")}
      </button>
    </form>
  );
  if (p.resume.experience.length + p.resume.skills.length === 0) {
    return (
      <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted">
        {t("discover.needProfile")}{" "}
        <Link href="/account/profile" className="font-medium text-ink underline underline-offset-4">
          {t("profile.build")}
        </Link>
      </p>
    );
  }
  if (!role) return form;

  const [g, roadmap] = await Promise.all([careerGaps(role, viewer), roadmapForTitle(role)]);
  const stageAt = STAGES.findIndex((s) => s.id === g.stage);
  const toBuild = g.skills.filter((s) => s.tier !== "verified" && s.tier !== "proven");
  const have = g.skills.filter((s) => s.tier === "verified" || s.tier === "proven");
  // Transferable skill intelligence: the bridge between the member's current role and the target, and the exact
  // experience that supports the move.
  const path = transitionPath(current?.title ?? p.headline, role);
  const routes = path ? transitionNetwork(path.from, path.to, [...p.resume.skills, ...g.skills.filter((s) => s.tier === "proven" || s.tier === "verified").map((s) => s.name)]) : [];
  const carries = g.skills.filter((s) => (s.tier === "proven" || s.tier === "verified" || s.tier === "transferable") && (s.quote || s.via)).slice(0, 6);

  return (
    <>
      {form}
      {g.jobs === 0 ? (
        <p className="mt-8 text-muted">{t("discover.none", { role })}</p>
      ) : (
        <>
          {path && (
            <section aria-labelledby="move-h" className="mt-8 rounded-3xl bg-ink p-5 text-paper sm:p-6">
              <h2 id="move-h" className="font-display text-xl font-semibold">
                {t("gaps.netTitle")}
              </h2>
              <p className="mt-1 text-sm text-[#c9d2de]">{t("gaps.netLead")}</p>
              <PathNetwork routes={routes} />
              {carries.length > 0 && (
                <>
                  <h3 className="mt-5 font-display font-semibold">{t("gaps.moveEvidence")}</h3>
                  <ul className="mt-2 flex flex-col gap-2 text-sm">
                    {carries.map((s) => (
                      <li key={s.name} className="rounded-xl bg-white/[0.06] p-3">
                        <span className="font-medium">{s.name}</span>
                        <span className="text-[#c9d2de]"> · {s.tier === "transferable" ? t("fit.ev_transferable", { via: s.via ?? "", where: s.where === "skills" ? t("fit.yourSkills") : (s.where ?? "") }) : t("fit.ev_proven", { where: s.where ?? "" })}</span>
                        {s.quote && <span className="mt-1 block border-s-2 border-signal ps-2 text-[#dfe5ec] italic">“{s.quote}”</span>}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>
          )}

          {/* Career roadmap: where the member is on the path to the role. */}
          <section aria-labelledby="path-h" className="mt-8 rounded-3xl border border-line bg-surface p-5 sm:p-6">
            <h2 id="path-h" className="font-display text-xl font-semibold">
              {t("gaps.pathTitle", { role })}
            </h2>
            <p className="text-sm text-muted">{t("gaps.pathLead", { n: g.jobs })}</p>
            <ol className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {STAGES.map((s, i) => {
                const done = i < stageAt;
                const now = i === stageAt;
                const Icon = s.icon;
                return (
                  <li key={s.id} className="flex flex-col items-center text-center">
                    <span
                      className={`grid size-12 place-items-center rounded-full border-2 ${done ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : now ? "border-signal bg-signal/20 text-signal-ink" : "border-dashed border-line text-muted"}`}
                    >
                      {done ? <Check aria-hidden="true" className="size-5" /> : <Icon aria-hidden="true" className="size-5" />}
                    </span>
                    <span className="mt-2 font-medium">{t(`gaps.stage_${s.id}`)}</span>
                    <span className="text-xs text-muted">{done ? t("gaps.done") : now ? t("gaps.now") : t("gaps.later")}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-5 rounded-xl bg-ink-soft/60 p-3 text-sm">{t(`gaps.advice_${g.stage}`)}</p>
          </section>

          {/* Skills to build next, by how often the role's jobs ask for them. */}
          <section aria-labelledby="skills-h" className="mt-8">
            <h2 id="skills-h" className="font-display text-2xl font-semibold">
              {t("gaps.skillsTitle")}
            </h2>
            <p className="text-sm text-muted">{t("gaps.skillsLead")}</p>
            <ul className="mt-4 flex flex-col gap-4">
              {toBuild.map((s) => (
                <li key={s.name}>
                  <GapCard s={s} roadmapSlug={roadmap?.slug ?? null} />
                </li>
              ))}
            </ul>
            {toBuild.length === 0 && <p className="mt-3 text-muted">{t("gaps.noneToBuild")}</p>}
          </section>

          {have.length > 0 && (
            <section aria-labelledby="have-h" className="mt-8">
              <h2 id="have-h" className="font-display text-xl font-semibold">
                {t("gaps.haveTitle")}
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {have.map((s) => (
                  <li key={s.name} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                    <Check aria-hidden="true" className="size-4 text-[#1f7a4d]" />
                    {s.name}
                    <span className="text-muted">· {t("gaps.inJobs", { n: s.demand })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {g.best.length > 0 && (
            <section aria-labelledby="opp-h" className="mt-8">
              <h2 id="opp-h" className="font-display text-xl font-semibold">
                {t("gaps.oppTitle")}
              </h2>
              <ul className="-mx-3 mt-2 divide-y divide-line sm:-mx-4">
                {g.best.map(({ job, fit }) => (
                  <li key={job.id}>
                    <JobRow job={job} fit={summarize(fit)} />
                  </li>
                ))}
              </ul>
              <Link href={`/discover?role=${encodeURIComponent(role)}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium underline underline-offset-4">
                {t("fit.discoverLink")}
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </section>
          )}
        </>
      )}
    </>
  );
}

/** One skill to build: how much employers ask for it, how far along the member is, and the actions that close it. */
function GapCard({ s, roadmapSlug }: { s: SkillGap; roadmapSlug: string | null }) {
  const lv = level(s.progress);
  return (
    <article className="rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,31,47,0.04),0_12px_32px_-18px_rgba(14,31,47,0.25)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-lg font-semibold">{s.name}</h3>
        <span className="text-sm text-muted">{t("gaps.inJobs", { n: s.demand })}</span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="h-2 flex-1 overflow-hidden rounded-full bg-ink-soft">
          <span className={`block h-full rounded-full ${s.progress >= 45 ? "bg-signal" : "bg-[#b4532a]"}`} style={{ width: `${Math.max(4, s.progress)}%` }} />
        </span>
        <span className="text-xs font-semibold whitespace-nowrap">{t(`gaps.level_${lv}`)}</span>
      </div>
      <p className="mt-2 text-sm text-ink/85">
        {s.tier === "listed" && t("gaps.now_listed", { where: s.where === "skills" ? t("fit.yourSkills") : (s.where ?? "") })}
        {s.tier === "transferable" && t("gaps.now_transferable", { via: s.via ?? "" })}
        {s.tier === "missing" && t("gaps.now_missing")}
      </p>
      <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <li className="rounded-xl bg-ink-soft/60 p-3">
          <span className="block text-xs font-semibold tracking-wide text-muted uppercase">1 · {t("gaps.learn")}</span>
          {roadmapSlug ? (
            <Link href={`/roadmaps/${roadmapSlug}`} className="mt-1 inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
              {t("gaps.learnRoadmap")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : (
            <Link href="/roadmaps" className="mt-1 inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
              {t("gaps.learnFind")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </li>
        <li className="rounded-xl bg-ink-soft/60 p-3">
          <span className="block text-xs font-semibold tracking-wide text-muted uppercase">2 · {t("gaps.project")}</span>
          <span className="mt-1 block">{t("gaps.projectIdea", { skill: s.name })}</span>
        </li>
        <li className="rounded-xl bg-ink-soft/60 p-3">
          <span className="block text-xs font-semibold tracking-wide text-muted uppercase">3 · {t("gaps.evidence")}</span>
          {s.test ? (
            <Link href="/skills" className="mt-1 inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
              {t("gaps.evidenceTest", { name: s.test.name })}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          ) : (
            <Link href="/account/profile" className="mt-1 inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
              {t("gaps.evidenceProfile")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          )}
        </li>
      </ol>
    </article>
  );
}
