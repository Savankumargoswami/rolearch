import { BadgeCheck } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { levelName, skillName } from "@/lib/skill-tests";
import { createClient } from "@/lib/supabase/server";

/** Verified skill badges on a member's profile (badges are public; answers aren't). */
export async function SkillBadges({ userId }: { userId: string }) {
  const db = await createClient();
  const { data } = await db.from("skill_badges").select("skill,level,score,awarded_at").eq("user_id", userId).order("awarded_at", { ascending: false });
  if (!data?.length) return null;
  return (
    <section aria-labelledby="badges-h" className="mt-8 rounded-3xl border border-line bg-surface p-5">
      <h2 id="badges-h" className="font-display text-xl font-semibold">
        {t("skills.badgesTitle")}
      </h2>
      <ul className="mt-3 flex flex-wrap gap-2">
        {data.map((b) => (
          <li key={`${b.skill}-${b.level}`} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-paper px-3 py-1.5 text-sm">
            <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
            {skillName(b.skill)} · {levelName(b.level)}
            <span className="text-muted">{Math.round(Number(b.score))}%</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** For a company viewing an applicant: every graded test, with links to the answers (RLS allows it because they applied). */
export async function ApplicantSkillTests({ userId }: { userId: string }) {
  const db = await createClient();
  const { data } = await db
    .from("skill_attempts")
    .select("id,skill,level,attempt_no,score,passed,submitted_at,proctor")
    .eq("user_id", userId)
    .eq("status", "graded")
    .order("submitted_at", { ascending: false })
    .limit(30);
  return (
    <section aria-labelledby="tests-h" className="mt-8">
      <h2 id="tests-h" className="font-display text-xl font-semibold">
        {t("skills.applicantTitle")}
      </h2>
      {!data?.length ? (
        <p className="mt-2 text-sm text-muted">{t("skills.applicantNone")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
          {data.map((a) => {
            const flags = Object.entries((a.proctor ?? {}) as Record<string, number>)
              .filter(([k]) => k !== "snapshot")
              .reduce((n, [, v]) => n + v, 0);
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <p className="flex items-center gap-1.5 font-medium">
                    {a.passed && <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />}
                    {skillName(a.skill)} · {levelName(a.level)} · {Math.round(Number(a.score))}%
                  </p>
                  <p className="text-sm text-muted">
                    {t("skills.attemptLine", { n: a.attempt_no, date: new Date(a.submitted_at).toLocaleDateString("en-US", { dateStyle: "medium" }) })}
                    {flags ? ` · ${flags} proctoring flag${flags === 1 ? "" : "s"}` : ""}
                  </p>
                </div>
                <Link href={`/skills/result/${a.id}`} className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm hover:bg-ink-soft">
                  {t("skills.viewAnswers")}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
