import { BadgeCheck, CircleCheck, CircleX, ShieldAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { ATTEMPT_COLUMNS, PASS_MARK, RETRY_HOURS, callAssess, deadlinePassed, levelName, skillName, type Attempt } from "@/lib/skill-tests";
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
  // RLS lets the candidate and companies the candidate applied to read the attempt; everyone else gets nothing.
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
  const [{ data: answers }, { data: files }] = await Promise.all([
    db.from("skill_answers").select("q_index,answer").eq("attempt_id", id),
    db.storage.from("proctor").list(`${attempt.user_id}/${id}`, { limit: 100, sortBy: { column: "name", order: "asc" } }),
  ]);
  const byIndex = new Map((answers ?? []).map((a) => [a.q_index, a.answer]));
  const paths = (files ?? []).map((f) => `${attempt.user_id}/${id}/${f.name}`);
  const { data: signed } = paths.length ? await db.storage.from("proctor").createSignedUrls(paths, 3600) : { data: [] };
  const score = Number(attempt.score ?? 0);
  const retry = attempt.submitted_at ? new Date(new Date(attempt.submitted_at).getTime() + RETRY_HOURS * 3600_000) : null;
  const flags = FLAG_KINDS.filter((k) => (attempt.proctor?.[k] ?? 0) > 0);

  return (
    <>
      <p className="text-sm text-muted">
        {t("skills.attemptLine", { n: attempt.attempt_no, date: new Date(attempt.started_at).toLocaleDateString("en-US", { dateStyle: "medium" }) })}
      </p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
        {t("skills.resultTitle", { skill: skillName(attempt.skill), level: levelName(attempt.level) })}
      </h1>
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
              {t("skills.retryNote", { when: retry.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" }) })}{" "}
              <Link href="/skills" className="underline">
                {t("skills.title")}
              </Link>
            </p>
          )
        )}
      </section>

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
          {attempt.questions.map((q, i) => {
            const r = attempt.results?.[i];
            const mine = byIndex.get(i) ?? "";
            const isChoice = q.kind === "output" || q.kind === "mcq";
            const chosen = isChoice && /^\d+$/.test(mine) ? q.options?.[Number(mine)] : mine;
            return (
              <li key={i} className="rounded-2xl border border-line bg-surface p-5">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {r?.correct ? (
                    <CircleCheck aria-label="Correct" className="size-5 text-[#2f6b3a]" />
                  ) : (
                    <CircleX aria-label="Not correct" className="size-5 text-red-700" />
                  )}
                  {t("skills.question", { n: i + 1, total: attempt.questions.length })} · {q.topic}
                  {r && <span className="ml-auto tabular-nums text-muted">{`${r.points} / ${r.max}`}</span>}
                </p>
                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-muted">Question</summary>
                  <pre className="mt-2 max-h-96 overflow-auto whitespace-pre-wrap rounded-xl bg-ink-soft p-3 font-mono text-[0.8rem]">{q.text}</pre>
                </details>
                <p className="mt-3 text-sm font-medium">{t("skills.yourAnswer")}</p>
                <pre className="mt-1 max-h-80 overflow-auto whitespace-pre-wrap rounded-xl border border-line p-3 font-mono text-[0.8rem]">
                  {chosen || t("skills.noAnswer")}
                </pre>
                {r && isChoice && !r.correct && r.answer && (
                  <>
                    <p className="mt-3 text-sm font-medium">{t("skills.correctAnswer")}</p>
                    <pre className="mt-1 whitespace-pre-wrap rounded-xl border border-[#2f6b3a]/30 bg-[#eef6ef] p-3 font-mono text-[0.8rem]">{r.answer}</pre>
                  </>
                )}
                {r && q.kind === "numeric" && !r.correct && r.answer && <p className="mt-3 text-sm">{`${t("skills.correctAnswer")}: ${r.answer}`}</p>}
                {r?.tests_total !== undefined && (
                  <p className="mt-3 text-sm text-muted">{t("skills.testsPassed", { passed: r.tests_passed ?? 0, total: r.tests_total })}</p>
                )}
                {r?.why && <p className="mt-3 text-sm leading-relaxed text-muted">{r.why}</p>}
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}
