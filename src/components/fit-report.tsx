import { AlertTriangle, ArrowUpRight, BadgeCheck, BriefcaseBusiness, CircleCheck, CircleDashed, CircleHelp, Repeat2, Target } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { FitVote } from "./fit-vote";
import type { Dimension, FitReport, SkillFit, Verdict } from "@/lib/fit";

const VERDICT: Record<Verdict, { color: string; bar: string; chip: string }> = {
  strong: { color: "text-[#1f7a4d]", bar: "bg-[#1f7a4d]", chip: "bg-[#1f7a4d]/12 text-[#1f7a4d]" },
  potential: { color: "text-[#3b6ea5]", bar: "bg-[#3b6ea5]", chip: "bg-[#3b6ea5]/12 text-[#2c5585]" },
  stretch: { color: "text-signal-ink", bar: "bg-signal", chip: "bg-signal/20 text-signal-ink" },
  poor: { color: "text-[#b4532a]", bar: "bg-[#b4532a]", chip: "bg-[#b4532a]/12 text-[#b4532a]" },
};

const barColor = (n: number) => (n >= 75 ? "bg-[#1f7a4d]" : n >= 50 ? "bg-signal" : "bg-[#b4532a]");

/** The Match Engine's job-fit report: a verdict, six scored dimensions, and the evidence and gaps behind them. */
export function FitReportView({ fit, jobTitle, jobId }: { fit: FitReport; jobTitle: string; jobId?: string }) {
  const v = VERDICT[fit.verdict];
  const strong = fit.skills.filter((s) => s.tier === "verified" || s.tier === "proven");
  const partial = fit.skills.filter((s) => s.tier === "listed" || s.tier === "transferable");
  const gaps = fit.skills.filter((s) => s.tier === "missing");
  const dim = (id: Dimension["id"]) => fit.dimensions.find((d) => d.id === id);
  const exp = dim("experience");
  const ind = dim("industry");
  const edu = dim("education");

  return (
    <section aria-labelledby="fit-h" className="rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,31,47,0.04),0_12px_32px_-18px_rgba(14,31,47,0.25)] sm:p-6">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        <Target aria-hidden="true" className="size-4" />
        {t("fit.eyebrow")}
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-x-5 gap-y-2">
        <p id="fit-h" className={`font-display text-6xl font-semibold tracking-[-0.04em] tabular-nums ${v.color}`}>
          {fit.score}
          <span className="text-2xl text-muted">/100</span>
        </p>
        <div className="pb-2">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${v.chip}`}>{t(`fit.verdict_${fit.verdict}`)}</span>
          <p className="mt-1 max-w-[46ch] text-[0.95rem]">{t(`fit.advice_${fit.verdict}`, { title: jobTitle })}</p>
        </div>
      </div>
      <p className="mt-1 text-xs text-muted">{t("fit.disclaimer")}</p>
      {jobId && (
        <div className="mt-2">
          <FitVote jobId={jobId} verdict={fit.verdict} score={fit.score} place="ats" />
        </div>
      )}

      <h3 className="mt-5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("fit.scoringTitle")}</h3>
      <ul className="mt-3 grid gap-x-8 gap-y-4 sm:grid-cols-2">
        {fit.dimensions.map((d) => (
          <li key={d.id}>
            <p className="flex items-baseline justify-between gap-3 text-[0.95rem]">
              <span className="font-medium">{t(`fit.dim_${d.id}`)}</span>
              <span className="tabular-nums text-muted">{d.score}/100</span>
            </p>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink-soft">
              <span className={`grow-x block h-full rounded-full ${barColor(d.score)}`} style={{ width: `${Math.max(4, d.score)}%` }} />
            </div>
            <p className="mt-1 text-sm text-muted">{dimNote(d)}</p>
          </li>
        ))}
      </ul>

      {fit.blockers.length > 0 && (
        <div className="mt-5 flex gap-3 rounded-2xl bg-[#b4532a]/10 p-4 text-[0.95rem]">
          <AlertTriangle aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-[#b4532a]" />
          <div>
            <p className="font-semibold text-[#b4532a]">{t("fit.blockersTitle")}</p>
            <p className="mt-0.5">{fit.blockers.join(" · ")}</p>
          </div>
        </div>
      )}

      {(strong.length > 0 || (exp && exp.score >= 75) || (ind && ind.score >= 100) || (edu && edu.score >= 100)) && (
        <Block icon={CircleCheck} tone="text-[#1f7a4d]" title={t("fit.whyTitle")}>
          {strong.slice(0, 6).map((s) => (
            <li key={s.name}>
              <SkillLine s={s} />
            </li>
          ))}
          {exp && Number(exp.values.need) > 0 && Number(exp.values.have) >= Number(exp.values.need) && (
            <li>{t("fit.whyYears", { have: exp.values.have, need: exp.values.need })}</li>
          )}
          {ind && ind.score >= 100 && <li>{t("fit.whyIndustry", { industry: ind.values.job })}</li>}
          {edu && edu.score >= 100 && edu.values.need !== "none" && <li>{t("fit.whyEducation")}</li>}
        </Block>
      )}

      {(partial.length > 0 || fit.confirm.length > 0) && (
        <Block icon={CircleHelp} tone="text-[#3b6ea5]" title={t("fit.verifyTitle")}>
          {partial.map((s) => (
            <li key={s.name}>
              <SkillLine s={s} />
            </li>
          ))}
          {fit.confirm.map((c) => (
            <li key={c}>{t("fit.confirm", { what: c })}</li>
          ))}
        </Block>
      )}

      {(gaps.length > 0 || (ind && ind.score < 100)) && (
        <Block icon={CircleDashed} tone="text-signal-ink" title={t("fit.gapsTitle")}>
          {gaps.map((s) => (
            <li key={s.name}>
              <span className="font-medium">{s.name}</span>
              <span className="text-muted"> · {t(`fit.group_${s.group}`)}</span>
              <span className="mt-0.5 block text-sm">
                {s.test ? (
                  <>
                    {t("fit.gapTest")}{" "}
                    <Link href="/skills" className="inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
                      {t("fit.takeTest", { name: s.test.name })}
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </Link>
                  </>
                ) : (
                  t("fit.gapProject", { name: s.name })
                )}
              </span>
            </li>
          ))}
          {ind && ind.score < 100 && (
            <li>
              {ind.values.yours ? t("fit.gapIndustryFrom", { job: ind.values.job, yours: ind.values.yours }) : t("fit.gapIndustry", { job: ind.values.job })}
            </li>
          )}
          <li className="text-sm">
            <Link href="/roadmaps" className="inline-flex items-center gap-1 font-medium underline underline-offset-4">
              {t("fit.roadmapLink")}
              <ArrowUpRight aria-hidden="true" className="size-3.5" />
            </Link>
          </li>
        </Block>
      )}
    </section>
  );
}

function dimNote(d: Dimension): string {
  const v = d.values;
  switch (d.id) {
    case "skills":
      return t("fit.note_skills", { strong: v.strong, partial: v.partial, missing: v.missing, total: v.total });
    case "experience": {
      const rel = (["same", "related", "different"] as const).find((x) => x === v.related) ?? "different";
      return Number(v.need) > 0
        ? t(`fit.note_experience_${rel}`, { have: v.have, need: v.need })
        : t(`fit.note_experience_noyears_${rel}`, { have: v.have });
    }
    case "industry":
      return v.yours === v.job ? t("fit.note_industry_same", { job: v.job }) : v.yours ? t("fit.note_industry_other", { job: v.job, yours: v.yours }) : t("fit.note_industry_none", { job: v.job });
    case "education":
      return d.score >= 100 ? t("fit.note_education_ok") : t("fit.note_education_short");
    case "location":
      return Number(v.blockers) > 0 ? t("fit.note_location_blocked") : Number(v.checks) > 0 ? t("fit.note_location_check", { n: v.checks }) : t("fit.note_location_ok");
    case "presentation":
      return Number(v.issues) > 0 ? t("fit.note_presentation", { n: v.issues }) : t("fit.note_presentation_ok");
  }
}

function SkillLine({ s }: { s: SkillFit }) {
  const icon =
    s.tier === "verified" ? (
      <BadgeCheck aria-hidden="true" className="inline size-4 align-[-3px] text-signal-ink" />
    ) : s.tier === "proven" ? (
      <BriefcaseBusiness aria-hidden="true" className="inline size-4 align-[-3px] text-muted" />
    ) : s.tier === "transferable" ? (
      <Repeat2 aria-hidden="true" className="inline size-4 align-[-3px] text-muted" />
    ) : null;
  return (
    <>
      <span className="font-medium">
        {icon} {s.name}
      </span>
      <span className="text-muted"> · {t(`fit.tier_${s.tier}`)}</span>
      <span className="mt-0.5 block text-sm text-ink/85">
        {s.tier === "verified" && t("fit.ev_verified", { test: s.test?.name ?? s.name })}
        {s.tier === "proven" && s.where && t("fit.ev_proven", { where: s.where })}
        {s.tier === "listed" && (s.where === "skills" ? t("fit.ev_listed_skills") : t("fit.ev_listed_project", { where: s.where ?? "" }))}
        {s.tier === "transferable" && t("fit.ev_transferable", { via: s.via ?? "", where: s.where === "skills" ? t("fit.yourSkills") : (s.where ?? "") })}
        {s.quote && <span className="mt-0.5 block border-s-2 border-line ps-2 text-muted italic">“{s.quote}”</span>}
        {(s.tier === "listed" || s.tier === "transferable") && s.test && (
          <Link href="/skills" className="mt-0.5 inline-flex items-center gap-0.5 font-medium underline underline-offset-4">
            {t("fit.verifyWith", { name: s.test.name })}
            <ArrowUpRight aria-hidden="true" className="size-3.5" />
          </Link>
        )}
      </span>
    </>
  );
}

function Block({ icon: Icon, tone, title, children }: { icon: typeof CircleCheck; tone: string; title: string; children: React.ReactNode }) {
  return (
    <div className="mt-5 border-t border-line pt-4">
      <h3 className={`flex items-center gap-2 font-display text-lg font-semibold ${tone}`}>
        <Icon aria-hidden="true" className="size-5" />
        <span className="text-ink">{title}</span>
      </h3>
      <ul className="mt-2 flex flex-col gap-2.5 text-[0.95rem] leading-relaxed">{children}</ul>
    </div>
  );
}
