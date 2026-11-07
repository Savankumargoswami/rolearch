// What Rolearch does differently, shown rather than told: the five core features (A to E), each with a live sample of
// the real screen, built from the same components the product uses. Sample data is labelled as such.
import { ArrowRight, Bookmark, Briefcase, Building2, Check, Flag, Hammer, Map as MapIcon, MapPin, Telescope, X } from "lucide-react";
import Link from "next/link";
import { PathNetwork } from "@/app/gaps/path-network";
import { Ring } from "@/app/discover/discovery-queue";
import { t } from "@/i18n";
import { transitionNetwork } from "@/lib/transitions";

type Block = { letter: string; tag: string; name: string; lead: string; points: string[]; href: string; cta: string };

const BLOCKS: Block[] = [
  {
    letter: "A",
    tag: "Core differentiator",
    name: "Transferable skill intelligence",
    lead: "Understand skills across industries, not just exact keywords. See every route from your current role and exactly which experience supports the move.",
    points: ["Manufacturing process improvement → operations analytics → business analytics", "Bridge roles, direct moves and nearby roles, side by side", "Skill overlap from what your profile actually shows"],
    href: "/gaps",
    cta: "Explore your career paths",
  },
  {
    letter: "B",
    tag: "Trust advantage",
    name: "Evidence-based resume tailoring",
    lead: "Every suggested edit rests on your actual work history, projects or verified skills. If there's no evidence, Rolearch asks you instead of inventing it.",
    points: ["The job requirement, your original line and the suggested edit, together", "Accept, Edit, Rewrite or Keep original for every change", "Skills you haven't used are never added"],
    href: "/ats",
    cta: "Tailor your resume",
  },
  {
    letter: "C",
    tag: "Job application decision engine",
    name: "RoleArch Job-Fit Intelligence",
    lead: "Instead of ranking jobs by keywords, Rolearch classifies them: strong fit, apply; potential fit, address specific gaps; stretch role, build skills first; low fit, don't waste the application. Every decision is explained.",
    points: ["Start with the roles most worth your time", "Fit scored on skills, experience, transferable skills, industry, education and location", "Bookmark or discard, and keep today's momentum"],
    href: "/discover",
    cta: "Open your discovery queue",
  },
  {
    letter: "D",
    tag: "Career gap-to-action roadmap",
    name: "Career gap-to-action roadmap",
    lead: "Missing SQL, Python or domain knowledge? Rolearch doesn't just list missing keywords: it recommends a learning path, a practical project, and the evidence to add once it's done.",
    points: ["Where you are: explore, learn and build, gain experience, land the role", "Skills to build next, ranked by how often jobs ask for them", "Opportunities that fit you now"],
    href: "/gaps",
    cta: "See your roadmap",
  },
  {
    letter: "E",
    tag: "Application outcome intelligence",
    name: "AI application manager",
    lead: "Track what actually happens. Which resume version gets interviews, which job types respond, which platforms work, and where applications stop.",
    points: ["Your funnel from applications sent to offers", "Interview rate by platform, resume version and job type", "Next steps, follow-ups and interviews in one dashboard"],
    href: "/tracker",
    cta: "Open your tracker",
  },
];

function Sample({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return (
    <div className={`@container relative overflow-hidden rounded-3xl p-4 shadow-[0_18px_50px_rgba(14,31,47,0.12)] sm:p-6 ${dark ? "bg-ink text-paper" : "border border-line bg-surface"}`}>
      <span className={`absolute end-3 top-3 rounded-full px-2 py-0.5 text-[0.65rem] font-semibold tracking-[0.12em] uppercase ${dark ? "bg-white/10 text-[#c9d2de]" : "bg-ink-soft text-muted"}`}>
        {t("show.sample")}
      </span>
      {children}
    </div>
  );
}

function SampleA() {
  const routes = transitionNetwork("Manufacturing engineer", "Data analyst", ["Excel", "Root cause analysis", "Statistics", "Process improvement"]);
  return (
    <Sample dark>
      <p className="font-display text-lg font-semibold">{t("gaps.netTitle")}</p>
      <PathNetwork routes={routes} />
    </Sample>
  );
}

function SampleB() {
  return (
    <Sample>
      <p className="text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t("ats.evRequirement")}</p>
      <p className="mt-1">Own onboarding analytics and reduce activation drop-off.</p>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t("ats.evOriginal")}</p>
      <p className="mt-1 text-muted">Built weekly SQL reports on where new users dropped out of onboarding.</p>
      <div className="mt-4 border-s-2 border-[#1f7a4d] ps-3">
        <p className="text-xs font-semibold tracking-[0.12em] text-[#1f7a4d] uppercase">{t("ats.evSuggested")}</p>
        <p className="mt-1">Analysed onboarding funnel drop-off in SQL and reported it weekly to the product team.</p>
      </div>
      <p className="mt-4 text-xs font-semibold tracking-[0.12em] text-muted uppercase">{t("show.bKeywords")}</p>
      <ul className="mt-2 flex flex-wrap gap-1.5">
        {["onboarding", "funnel", "SQL", "activation"].map((k, i) => (
          <li key={k} className={`rounded-md px-1.5 py-0.5 font-mono text-xs ${i < 3 ? "bg-[#3b6ea5]/12 text-[#2c5585]" : "border border-dashed border-muted/60 text-muted"}`}>
            {k}
          </li>
        ))}
      </ul>
      <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
        <X aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-[#b4532a]" />
        {t("show.bNoEvidence")}
      </p>
      <div className="mt-4 flex flex-wrap gap-2" aria-hidden="true">
        <span className="rounded-full bg-[#1f7a4d] px-3 py-1.5 text-xs font-semibold text-white">{t("ats.evAccept")}</span>
        <span className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold">{t("ats.evEdit")}</span>
        <span className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold">{t("ats.evRewrite")}</span>
        <span className="rounded-full border border-line px-3 py-1.5 text-xs font-semibold">{t("ats.evKeep")}</span>
      </div>
    </Sample>
  );
}

function SampleC() {
  return (
    <Sample>
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("discover.queueTitle")}</p>
      <p className="mt-1 font-display text-xl font-semibold tracking-[-0.01em]">
        {t("discover.titleA")} <em className="font-normal text-signal-ink">{t("discover.titleB")}</em>
      </p>
      <div className="mt-4 grid gap-4 @xl:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="font-display text-lg font-semibold">Operations Data Analyst</p>
          <p className="text-sm text-muted">
            {t("discover.at")} <span className="font-medium text-ink">Northwind Logistics</span>
          </p>
          <div className="mt-3 grid grid-cols-3 gap-1.5 text-xs">
            {[
              { icon: MapPin, l: t("discover.tileLocation"), v: "Toronto" },
              { icon: Building2, l: t("discover.tileMode"), v: t("posts.workplace_hybrid") },
              { icon: Briefcase, l: t("discover.tileLevel"), v: t("jobs.levels.mid") },
            ].map(({ icon: Icon, l, v }) => (
              <div key={l} className="min-w-0 rounded-lg border border-line bg-paper/40 p-2">
                <span className="flex items-center gap-1 text-muted">
                  <Icon aria-hidden="true" className="size-3" />
                  {l}
                </span>
                <span className="block truncate font-medium">{v}</span>
              </div>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden="true">
            <span className="rounded-full bg-ink px-3 py-1.5 text-xs font-semibold text-paper">{t("discover.open")}</span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold">
              <Bookmark className="size-3" />
              {t("discover.bookmark")}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-line px-3 py-1.5 text-xs font-semibold text-muted">
              <X className="size-3" />
              {t("discover.discard")}
            </span>
          </div>
        </div>
        <div className="rounded-2xl bg-paper/40 p-3">
          <p className="font-display text-4xl font-semibold text-[#1f7a4d] tabular-nums">
            86<span className="text-xl">%</span>
          </p>
          <p className="text-sm font-semibold text-[#1f7a4d]">{t("fit.verdict_strong")}</p>
          <div className="mt-2 flex justify-between gap-1">
            <Ring value={85} label={t("discover.ringLocation")} />
            <Ring value={82} label={t("discover.ringExperience")} />
            <Ring value={90} label={t("discover.ringAlignment")} />
          </div>
          <p className="mt-3 text-xs font-semibold">{t("discover.momentum")}</p>
          <p className="text-xs text-muted">{t("discover.momentumCount", { n: 1, goal: 3 })}</p>
          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-soft">
            <div className="h-full w-1/3 rounded-full bg-signal" />
          </div>
        </div>
      </div>
    </Sample>
  );
}

function SampleD() {
  const stages = [
    { id: "explore", icon: Telescope, state: "done" },
    { id: "learn", icon: MapIcon, state: "now" },
    { id: "experience", icon: Hammer, state: "later" },
    { id: "land", icon: Flag, state: "later" },
  ] as const;
  const skills = [
    { n: "SQL", p: 80, l: "level_advanced" },
    { n: "Product analytics", p: 65, l: "level_intermediate" },
    { n: "Python", p: 45, l: "level_intermediate" },
    { n: "Stakeholder communication", p: 30, l: "level_beginner" },
  ] as const;
  return (
    <Sample>
      <p className="font-display text-lg font-semibold">{t("show.dRoadmap")}</p>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {stages.map(({ id, icon: Icon, state }) => (
          <li key={id} className="flex flex-col items-center text-center">
            <span
              className={`grid size-10 place-items-center rounded-full border-2 ${state === "done" ? "border-[#1f7a4d] bg-[#1f7a4d] text-white" : state === "now" ? "border-signal bg-signal/20 text-signal-ink" : "border-dashed border-line text-muted"}`}
            >
              {state === "done" ? <Check aria-hidden="true" className="size-4" /> : <Icon aria-hidden="true" className="size-4" />}
            </span>
            <span className="mt-1 text-xs font-medium">{t(`gaps.stage_${id}`)}</span>
            <span className="text-[0.65rem] text-muted">{state === "done" ? t("gaps.done") : state === "now" ? t("gaps.now") : t("gaps.later")}</span>
          </li>
        ))}
      </ol>
      <p className="mt-5 text-sm font-semibold">{t("gaps.skillsTitle")}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {skills.map((s) => (
          <li key={s.n} className="grid grid-cols-[minmax(0,8.5rem)_1fr_2.25rem_auto] items-center gap-2 text-xs sm:text-sm">
            <span className="truncate">{s.n}</span>
            <span aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-ink-soft">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${s.p}%` }} />
            </span>
            <span className="text-end text-muted tabular-nums">{s.p}%</span>
            <span className="rounded-full bg-ink-soft px-2 py-0.5 text-[0.65rem] font-semibold">{t(`gaps.${s.l}`)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 rounded-xl bg-ink-soft/60 p-3 text-xs">{t("show.dProject")}</p>
    </Sample>
  );
}

function SampleE() {
  const funnel = [
    { l: t("tracker.funnelApplied"), n: 42 },
    { l: t("tracker.funnelResponses"), n: 15 },
    { l: t("tracker.funnelInterviews"), n: 6 },
    { l: t("tracker.funnelOffers"), n: 2 },
  ];
  const platforms = [
    { k: "Greenhouse", p: 21 },
    { k: "Lever", p: 18 },
    { k: "Rolearch", p: 25 },
    { k: "Workday", p: 9 },
    { k: "Company site", p: 12 },
  ].sort((a, b) => b.p - a.p);
  return (
    <Sample dark>
      <p className="font-display text-lg font-semibold">{t("tracker.funnelTitle")}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {funnel.map((x) => (
          <li key={x.l} className="grid grid-cols-[7.5rem_1fr_2.5rem] items-center gap-2 text-xs sm:text-sm">
            <span className="text-[#c9d2de]">{x.l}</span>
            <span className="h-6 overflow-hidden rounded-md bg-white/10">
              <span className="flex h-full items-center rounded-md bg-signal px-2 font-semibold text-ink tabular-nums" style={{ width: `${Math.max(10, (x.n / 42) * 100)}%` }}>
                {x.n}
              </span>
            </span>
            <span className="text-end text-xs text-[#c9d2de] tabular-nums">{Math.round((x.n / 42) * 100)}%</span>
          </li>
        ))}
      </ul>
      <div className="mt-5 rounded-2xl bg-white/[0.06] p-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-sm font-semibold">{t("outcomes.byPlatform")}</p>
          <span className="text-[0.65rem] text-[#c9d2de]">{t("outcomes.higherBetter")}</span>
        </div>
        <ul className="mt-3 flex h-28 items-end gap-2">
          {platforms.map((d) => (
            <li key={d.k} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
              <span className="text-[0.65rem] font-semibold tabular-nums">{d.p}%</span>
              <span className="w-full max-w-10 rounded-t-md bg-signal" style={{ height: `${(d.p / 25) * 100}%` }} />
              <span className="w-full truncate text-center text-[0.6rem] font-semibold tracking-[0.06em] text-[#c9d2de] uppercase">{d.k}</span>
            </li>
          ))}
        </ul>
      </div>
    </Sample>
  );
}

const SAMPLES: Record<string, () => React.ReactNode> = { A: SampleA, B: SampleB, C: SampleC, D: SampleD, E: SampleE };

/** The five core features, each with a sample of the real screen. */
export function HomeShowcase() {
  return (
    <section aria-labelledby="show-h" className="mx-auto mt-24 max-w-6xl px-4 sm:px-6">
      <p className="text-xs font-semibold tracking-[0.14em] text-signal-ink uppercase">{t("show.eyebrow")}</p>
      <h2 id="show-h" className="mt-2 max-w-[22ch] font-display text-3xl font-semibold leading-[1.05] tracking-[-0.025em] text-balance sm:text-5xl">
        {t("show.title")}
      </h2>
      <p className="mt-4 max-w-[62ch] text-lg text-muted text-pretty">{t("show.lead")}</p>
      <ol className="mt-12 flex flex-col gap-16 sm:gap-20">
        {BLOCKS.map((b, i) => {
          const S = SAMPLES[b.letter];
          return (
            <li key={b.letter} id={`feature-${b.letter.toLowerCase()}`} className="grid scroll-mt-24 gap-8 lg:grid-cols-2 lg:items-center lg:gap-12">
              <div className={i % 2 ? "lg:order-2" : ""}>
                <p className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-full bg-ink font-display text-lg font-semibold text-paper">{b.letter}</span>
                  <span className="rounded-full bg-signal/25 px-3 py-1 text-xs font-semibold">{b.tag}</span>
                </p>
                <h3 className="mt-4 font-display text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{b.name}</h3>
                <p className="mt-3 text-muted text-pretty">{b.lead}</p>
                <ul className="mt-4 flex flex-col gap-2">
                  {b.points.map((p) => (
                    <li key={p} className="flex gap-2.5 text-sm">
                      <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-signal text-ink">
                        <Check aria-hidden="true" className="size-3" strokeWidth={3} />
                      </span>
                      {p}
                    </li>
                  ))}
                </ul>
                <Link href={b.href} className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover">
                  {b.cta}
                  <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
                </Link>
              </div>
              <div className={`min-w-0 ${i % 2 ? "lg:order-1" : ""}`}>
                <S />
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-14 text-center">
        <Link href="/features" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-ink px-5 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
          {t("show.all")}
          <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
      </p>
    </section>
  );
}
