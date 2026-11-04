import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { requireMember } from "@/lib/require-member";
import { ATTEMPT_COLUMNS, callAssess, deadlinePassed, levelName, skillName, type Attempt, type PublicQuestion } from "@/lib/skill-tests";
import { createClient } from "@/lib/supabase/server";
import { TestRunner } from "./test-runner";

export const metadata: Metadata = { title: "Skill test", robots: { index: false } };

export default function TestPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="mx-auto mt-10 h-96 max-w-5xl animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
      <Test params={params} />
    </Suspense>
  );
}

async function Test({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireMember(`/skills/test/${id}`);
  const db = await createClient();
  const { data } = await db.from("skill_attempts").select(ATTEMPT_COLUMNS).eq("id", id).eq("user_id", viewer.id).maybeSingle();
  if (!data) notFound();
  const attempt = data as Attempt;
  if (attempt.status !== "in_progress") redirect(`/skills/result/${id}`);
  if (deadlinePassed(attempt.deadline)) {
    await callAssess("/submit", { user_id: viewer.id, attempt_id: id }); // time ran out while away: grade what was saved
    redirect(`/skills/result/${id}`);
  }
  const [{ data: questions }, { data: saved }] = await Promise.all([
    db.rpc("my_skill_test_questions", { p_attempt: id }),
    db.from("skill_answers").select("q_index,answer").eq("attempt_id", id),
  ]);
  if (!questions) notFound();
  const answers: Record<number, string> = {};
  for (const row of saved ?? []) answers[row.q_index] = row.answer;
  return (
    <TestRunner
      attemptId={id}
      title={`${skillName(attempt.skill)} · ${levelName(attempt.level)}`}
      deadline={attempt.deadline}
      questions={questions as PublicQuestion[]}
      saved={answers}
    />
  );
}
