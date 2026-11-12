import { BadgeCheck, CircleCheck, CircleX, ExternalLink, GraduationCap, ShieldAlert } from "lucide-react";
import { FreeLearningCard } from "@/components/free-learning";
import { LocalTime } from "@/components/local-time";
import { testResources } from "@/data/learning";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { badgeCode, badgeTitle, linkedInAddUrl } from "@/lib/badge";
import { requireMember } from "@/lib/require-member";
import { utm } from "@/lib/utm";
import { ATTEMPT_COLUMNS, PASS_MARK, RETRY_HOURS, callAssess, deadlinePassed, levelName, skillName, type Attempt, type Review } from "@/lib/skill-tests";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Skill test result", robots: { index: false } };

export default function ResultPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Result params={params} />
      </Suspense>
    </div>
  );
}

const FLAG_KINDS = ["hidden", "blur", "fullscreen_exit", "paste", "copy", "contextmenu", "devtools", "camera_off"] as const;

async function Result({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireMember(`/skills/result/${id}`);
  const db = await createClient();
  // RLS lets the candidate and companies the candidate applied to read the attempt's summary; everyone else gets nothing.
  let { data } = await db.from("skill_attempts").select(ATTEMPT_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  let attempt = data as Attempt;
  const own = attempt.user_id === viewer.id;
  if (attempt.status === "in_progress") {
    if (!own) notFound();
    if (!deadlinePassed(attempt.deadline)) redirect(`/skills/test/${id}`);
    await callAssess("/submit", { user_id: viewer.id, attempt_id: id });
    ({ data } = await db.from("skill_attempts").select(ATTEMPT_COLUMNS).eq("id", id).maybeSingle());
    attempt = data as Attempt;
  }
  return (
    <>
      <p className="text-sm text-muted">
        {t("skills.attemptLine", { n: attempt.attempt_no, date: new Date(attempt.started_at).toLocaleDateString("en-US", { dateStyle: "medium" }) })}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
        {t("skills.resultTitle", { skill: skillName(attempt.skill), level: levelName(attempt.level) })}
      </h1>
      <Outcome attempt={attempt} own={own} />
      {own && attempt.status !== "in_progress" && !attempt.passed && <Prepare skill={attempt.skill} />}
      {own && attempt.passed && <BadgeShare attemptId={attempt.id} skill={skillName(attempt.skill)} level={levelName(attempt.level)} issued={attempt.submitted_at ?? attempt.started_at} />}
      {own ? <p className="mt-6 text-sm text-muted">{t("skills.privateNote")}</p> : <CompanyReview attempt={attempt} />}
    </>
  );
}

/** After a test that wasn't passed: free courses for the skill, before the retake. */
function Prepare({ skill }: { skill: string }) {
  const { featured, links } = testResources(skill);
  if (!featured && !links.length) return null;
  return (
    <section aria-labelledby="prepare-h" className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="prepare-h" className="flex items-center gap-2 font-display text-xl font-semibold">
        <GraduationCap aria-hidden="true" className="size-5 text-signal-ink" />
        {t("skills.prepareTitle")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("skills.prepareLead", { skill: skillName(skill) })}</p>
      <div className="mt-4 max-w-md">
        <FreeLearningCard featured={featured} links={links} />
      </div>
    </section>
  );
}

function Outcome({ attempt, own }: { attempt: Attempt; own: boolean }) {
  const score = Number(attempt.score ?? 0);
  const retry = attempt.submitted_at ? new Date(new Date(attempt.submitted_at).getTime() + RETRY_HOURS * 3600_000) : null;
  return (
    <section className={`mt-6 rounded-3xl border p-6 ${attempt.passed ? "border-[#2f6b3a]/30 bg-[#eef6ef]" : "border-line bg-surface"}`}>
      <p className="flex items-center gap-2 font-display text-2xl font-semibold">
        {attempt.passed ? <BadgeCheck aria-hidden="true" className="size-7 text-[#2f6b3a]" /> : <ShieldAlert aria-hidden="true" className="size-7 text-signal-ink" />}
        {attempt.passed ? t("skills.youPassed") : t("skills.notYet")}
      </p>
      <p className="mt-1 text-lg">{t("skills.scoreLine", { score: score.toFixed(score % 1 ? 1 : 0) })}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink-soft" aria-hidden="true">
        <div className="relative h-full rounded-full bg-ink" style={{ width: `${Math.min(100, score)}%` }} />
      </div>
      <p className="mt-1 text-xs text-muted" aria-hidden="true" style={{ paddingLeft: `${PASS_MARK - 2}%` }}>
        ▲ {PASS_MARK}%
      </p>
      {attempt.passed ? (
        <p className="mt-3 text-sm">{t("skills.earned")}</p>
      ) : (
        own &&
        retry && (
          <p className="mt-3 text-sm text-muted">
            {(() => {
              const [before, after] = t("skills.retryNote", { when: "\u0000" }).split("\u0000");
              return (
                <>
                  {before}
                  <LocalTime iso={retry.toISOString()} />
                  {after}
                </>
              );
            })()}{" "}
            <Link href="/skills" className="underline">
              {t("skills.title")}
            </Link>
          </p>
        )
      )}
    </section>
  );
}

/** Only a company the candidate applied to gets here; skill_attempt_review() and the RLS policies enforce the same rule (db/030). */
async function CompanyReview({ attempt }: { attempt: Attempt }) {
  const db = await createClient();
  const [{ data: review }, { data: answers }, { data: files }] = await Promise.all([
    db.rpc("skill_attempt_review", { p_attempt: attempt.id }),
    db.from("skill_answers").select("q_index,answer").eq("attempt_id", attempt.id),
    db.storage.from("proctor").list(`${attempt.user_id}/${attempt.id}`, { limit: 100, sortBy: { column: "name", order: "asc" } }),
  ]);
  const r = review as Review | null;
  if (!r) return null;
  const byIndex = new Map((answers ?? []).map((a) => [a.q_index, a.answer]));
  const paths = (files ?? []).map((f) => `${attempt.user_id}/${attempt.id}/${f.name}`);
  const { data: signed } = paths.length ? await db.storage.from("proctor").createSignedUrls(paths, 3600) : { data: [] };
  const flags = FLAG_KINDS.filter((k) => (attempt.proctor?.[k] ?? 0) > 0);

  return (
    <>
      <section aria-labelledby="proctor-h" className="mt-8 rounded-3xl border border-line bg-surface p-6">
        <h2 id="proctor-h" className="font-display text-xl font-semibold">
          {t("skills.proctorTitle")}
        </h2>
        {flags.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {flags.map((k) => (
              <li key={k} className="rounded-full bg-ink-soft px-3 py-1 text-sm">
                {t(`skills.flags.${k}` as MessageKey)}: {attempt.proctor[k]}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("skills.proctorNone")}</p>
        )}
        {(signed ?? []).length > 0 && (
          <>
            <p className="mt-5 text-sm font-medium">{t("skills.snapshots")}</p>
            <ul className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
              {(signed ?? []).map((s) =>
                s.signedUrl ? (
                  <li key={s.path}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URLs from private storage */}
                    <img src={s.signedUrl} alt="Camera snapshot during the test" className="aspect-[4/3] w-full rounded-lg object-cover" />
                  </li>
                ) : null,
              )}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="review-h" className="mt-8">
        <h2 id="review-h" className="font-display text-xl font-semibold">
          {t("skills.review")}
        </h2>
        <ol className="mt-4 space-y-4">
          {r.questions.map((q, i) => {
            const res = r.results?.[i];
            const mine = byIndex.get(i) ?? "";
            const isChoice = q.kind === "output" || q.kind === "mcq";
            const chosen = isChoice && /^\d+$/.test(mine) ? q.options?.[Number(mine)] : mine;
            return (
              <li key={i} className="rounded-2xl border border-line bg-surface p-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {res?.correct ? (
                    <CircleCheck aria-label="Correct" className="size-5 text-[#2f6b3a]" />
                  ) : (
                    <CircleX aria-label="Not correct" className="size-5 text-red-700" />
                  )}
                  {t("skills.question", { n: i + 1, total: r.questions.length })} · {q.topic}
                  {res && <span className="ml-auto tabular-nums text-muted">{`${res.points} / ${res.max}`}</span>}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted">Question</summary>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-soft p-3 font-mono text-[0.8rem]">{q.text}</pre>
                </details>
                <p className="mt-3 text-sm font-medium">{t("skills.candidateAnswer")}</p>
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line p-3 font-mono text-[0.8rem]">
                  {chosen || t("skills.noAnswer")}
                </pre>
                {res && isChoice && !res.correct && res.answer && (
                  <>
                    <p className="mt-3 text-sm font-medium">{t("skills.correctAnswer")}</p>
                    <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-[#2f6b3a]/30 bg-[#eef6ef] p-3 font-mono text-[0.8rem]">{res.answer}</pre>
                  </>
                )}
                {res && q.kind === "numeric" && !res.correct && res.answer && <p className="mt-3 text-sm">{`${t("skills.correctAnswer")}: ${res.answer}`}</p>}
                {res?.tests_total !== undefined && (
                  <p className="mt-3 text-sm text-muted">{t("skills.testsPassed", { passed: res.tests_passed ?? 0, total: res.tests_total })}</p>
                )}
                {res?.why && <p className="mt-3 text-sm leading-relaxed text-muted">{res.why}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

/** A passed test: add the badge to LinkedIn as a certification, or share its public page. */
function BadgeShare({ attemptId, skill, level, issued }: { attemptId: string; skill: string; level: string; issued: string }) {
  const code = badgeCode(attemptId);
  const page = `https://www.rolearch.com/badge/${code}`;
  const badge = { id: attemptId, skill, level, score: 0, issued };
  const btn = "inline-flex min-h-11 items-center gap-2 rounded-full px-5 text-sm font-medium transition-transform active:scale-[0.96]";
  return (
    <section aria-labelledby="badge-share-h" className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <h2 id="badge-share-h" className="font-display text-xl font-semibold">
        Show it on LinkedIn
      </h2>
      <p className="mt-1 text-sm text-muted">
        Adds &ldquo;{badgeTitle(badge)}&rdquo; to your Licenses &amp; certifications, linked to a page that confirms your result without showing your name.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href={linkedInAddUrl(badge, utm(page, "linkedin", "certification", "skill-badge"))} target="_blank" rel="noopener noreferrer" className={`${btn} bg-ink text-paper hover:bg-ink-hover`}>
          <BadgeCheck aria-hidden="true" className="size-4" />
          Add to LinkedIn profile
        </a>
        <a
          href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(utm(page, "linkedin", "social", "skill-badge"))}`}
          target="_blank"
          rel="noopener noreferrer"
          className={`${btn} border border-line hover:border-ink`}
        >
          Post about it
        </a>
        <a href={`/badge/${code}`} target="_blank" rel="noopener noreferrer" className={`${btn} border border-line hover:border-ink`}>
          <ExternalLink aria-hidden="true" className="size-4" />
          View badge page
        </a>
      </div>
    </section>
  );
}
