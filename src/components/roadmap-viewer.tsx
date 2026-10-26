"use client";

import {
  Award,
  BookA,
  BookOpen,
  CircleCheck,
  CircleHelp,
  CirclePlay,
  Clock,
  Dumbbell,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Lightbulb,
  ListChecks,
  Loader2,
  MessagesSquare,
  Rocket,
  Sparkles,
  Target,
  TrendingUp,
  TriangleAlert,
  Trophy,
  Wrench,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadRoadmap } from "@/app/roadmaps/actions";
import type { Resource, Roadmap, RoadmapSkill, RoadmapStage } from "@/lib/roadmaps";

// Members-only roadmap, with the protections a web page can offer: it loads after the page (not in the HTML), can't be
// selected, copied, printed or saved with the usual shortcuts, blurs when the window loses focus or a screenshot key is
// pressed, and carries a faint Rolearch watermark. A screenshot tool or a phone camera can't be stopped by any website;
// the watermark marks any shared copy as Rolearch's.

// One accent per stage, from the site's palette: it carries through the stepper, the stage header and its skill cards.
const ACCENTS = [
  { ring: "ring-[#2f7d6d]", border: "border-[#2f7d6d]", bg: "bg-[#2f7d6d]", soft: "bg-[#2f7d6d]/10", text: "text-[#2f7d6d]" },
  { ring: "ring-[#2f5f9e]", border: "border-[#2f5f9e]", bg: "bg-[#2f5f9e]", soft: "bg-[#2f5f9e]/10", text: "text-[#2f5f9e]" },
  { ring: "ring-[#8a5a1c]", border: "border-[#8a5a1c]", bg: "bg-[#8a5a1c]", soft: "bg-[#8a5a1c]/10", text: "text-[#8a5a1c]" },
  { ring: "ring-[#7a3b6e]", border: "border-[#7a3b6e]", bg: "bg-[#7a3b6e]", soft: "bg-[#7a3b6e]/10", text: "text-[#7a3b6e]" },
];

/** 16 -> "16 weeks", 60 -> "14 months", 156 -> "3 years" (some careers include years of degree study). */
function duration(w: number) {
  if (!w) return "";
  if (w <= 20) return `${w} weeks`;
  if (w < 104) return `${Math.round(w / 4.33)} months`;
  return `${(w / 52).toFixed(1).replace(/\.0$/, "")} years`;
}

const SECTIONS = [
  { id: "rm-stages", label: "Roadmap", icon: Layers },
  { id: "rm-ladder", label: "Career ladder", icon: TrendingUp },
  { id: "rm-tools", label: "Tools", icon: Wrench },
  { id: "rm-credentials", label: "Credentials", icon: Award },
  { id: "rm-interview", label: "Interview", icon: MessagesSquare },
  { id: "rm-glossary", label: "Glossary", icon: BookA },
  { id: "rm-mistakes", label: "Mistakes", icon: TriangleAlert },
];

export function RoadmapViewer({ slug }: { slug: string }) {
  const [data, setData] = useState<Roadmap | null | undefined>(undefined);
  const [hidden, setHidden] = useState(false);
  const [stage, setStage] = useState(0);

  useEffect(() => {
    loadRoadmap(slug).then(setData).catch(() => setData(null));
  }, [slug]);

  useEffect(() => {
    const stop = (e: Event) => e.preventDefault();
    const hide = () => setHidden(true);
    const show = () => setHidden(false);
    const keys = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "printscreen") {
        hide();
        navigator.clipboard?.writeText("").catch(() => {});
        setTimeout(show, 1500);
      }
      if ((e.ctrlKey || e.metaKey) && ["c", "x", "p", "s", "a", "u"].includes(k)) e.preventDefault();
      if (e.metaKey && e.shiftKey && ["3", "4", "5"].includes(k)) hide();
    };
    const visibility = () => (document.hidden ? hide() : show());
    for (const t of ["contextmenu", "copy", "cut", "dragstart", "selectstart"]) document.addEventListener(t, stop);
    document.addEventListener("keydown", keys);
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("blur", hide);
    window.addEventListener("focus", show);
    window.addEventListener("beforeprint", hide);
    window.addEventListener("afterprint", show);
    return () => {
      for (const t of ["contextmenu", "copy", "cut", "dragstart", "selectstart"]) document.removeEventListener(t, stop);
      document.removeEventListener("keydown", keys);
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", show);
      window.removeEventListener("beforeprint", hide);
      window.removeEventListener("afterprint", show);
    };
  }, []);

  const watermark = useMemo(() => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='300' height='180'><text x='40' y='100' transform='rotate(-24 150 90)' font-family='sans-serif' font-size='22' font-weight='700' fill='rgba(16,35,63,0.08)'>Rolearch</text></svg>`;
    return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
  }, []);

  if (data === undefined)
    return (
      <p className="mt-8 flex items-center gap-2 text-muted">
        <Loader2 aria-hidden="true" className="size-4 animate-spin" /> Loading your roadmap…
      </p>
    );
  if (data === null) return <p className="mt-8 text-muted">This roadmap isn&apos;t available right now.</p>;

  const skills = data.stages.reduce((n, s) => n + s.skills.length, 0);
  const resources = data.stages.reduce((n, s) => n + s.skills.reduce((m, k) => m + k.resources.length, 0), 0);
  const weeks = data.stages.reduce((n, s) => n + (Number(s.weeks) || 0), 0);
  const current = data.stages[Math.min(stage, data.stages.length - 1)];
  const sections = SECTIONS.filter((s) => {
    if (s.id === "rm-ladder") return (data.ladder?.length ?? 0) > 0;
    if (s.id === "rm-tools") return (data.tools?.length ?? 0) > 0;
    if (s.id === "rm-glossary") return (data.glossary?.length ?? 0) > 0;
    return true;
  });

  return (
    <div className="roadmap-protected relative mt-6 select-none" style={{ WebkitUserSelect: "none" }}>
      <style>{`@media print { .roadmap-protected { display: none !important; } body::after { content: "Roadmaps are available on Rolearch."; font: 20px sans-serif; } }`}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20" style={{ backgroundImage: watermark }} />
      <div className={`transition-[filter] duration-200 ${hidden ? "blur-xl" : ""}`}>
        {/* Overview */}
        <div className="rounded-3xl bg-ink p-6 text-paper sm:p-8">
          <p className="flex items-center gap-2 text-sm font-medium text-signal">
            <Sparkles aria-hidden="true" className="size-4" /> Your path to {data.role}
          </p>
          <p className="mt-3 max-w-[65ch] text-lg leading-relaxed text-[#e6ebf1]">{data.summary}</p>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat value={data.stages.length} label="stages" />
            <Stat value={weeks ? `~${duration(weeks)}` : "–"} label="part-time" />
            <Stat value={skills} label="skills" />
            <Stat value={resources} label="free resources" />
          </dl>
        </div>

        {/* Jump menu */}
        <nav aria-label="Roadmap sections" className="sticky top-16 z-10 -mx-1 mt-6 overflow-x-auto bg-paper/90 px-1 py-2 backdrop-blur">
          <ul className="flex gap-2">
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full border border-line bg-surface px-3.5 text-sm font-medium hover:border-ink">
                  <s.icon aria-hidden="true" className="size-4" />
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        {/* Stages */}
        <section id="rm-stages" className="mt-6 scroll-mt-32">
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4" aria-label="Stages">
            {data.stages.map((s, i) => {
              const a = ACCENTS[i % ACCENTS.length];
              const on = i === stage;
              return (
                <li key={s.level}>
                  <button
                    type="button"
                    onClick={() => setStage(i)}
                    aria-current={on ? "step" : undefined}
                    className={`flex h-full w-full cursor-pointer flex-col items-start gap-1 rounded-2xl border p-3 text-start transition-all ${on ? `border-transparent ${a.soft} ring-2 ${a.ring}` : "border-line bg-surface hover:border-ink"}`}
                  >
                    <span className={`grid size-7 place-items-center rounded-full text-sm font-bold text-white ${a.bg}`}>{i + 1}</span>
                    <span className="font-semibold">{s.level}</span>
                    <span className="text-xs text-muted">
                      {s.skills.length} skills · ~{duration(Number(s.weeks))}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          <StageView stage={current} index={stage} />
          <div className="mt-6 flex justify-between gap-3">
            <button type="button" disabled={stage === 0} onClick={() => setStage(stage - 1)} className="min-h-11 cursor-pointer rounded-full border border-line px-5 font-medium hover:border-ink disabled:invisible">
              ← {data.stages[stage - 1]?.level}
            </button>
            <button type="button" disabled={stage >= data.stages.length - 1} onClick={() => setStage(stage + 1)} className="min-h-11 cursor-pointer rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:invisible">
              {data.stages[stage + 1]?.level} →
            </button>
          </div>
        </section>

        {data.ladder && data.ladder.length > 0 && (
          <Section id="rm-ladder" icon={TrendingUp} title="Career ladder">
            <ol className="relative ms-3 border-s-2 border-line">
              {data.ladder.map((l, i) => (
                <li key={l.title} className="relative mb-4 ps-6 last:mb-0">
                  <span className={`absolute -start-[9px] top-4 size-4 rounded-full ring-4 ring-paper ${ACCENTS[Math.min(i, 3)].bg}`} />
                  <div className="rounded-2xl border border-line bg-surface p-4">
                    <p className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold">{l.title}</span>
                      <span className="rounded-full bg-ink-soft px-2.5 py-0.5 text-xs font-medium">{l.years}</span>
                    </p>
                    <p className="mt-1 text-sm text-muted">{l.moves_you_up}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {data.tools && data.tools.length > 0 && (
          <Section id="rm-tools" icon={Wrench} title="Tools of the trade">
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.tools.map((t) => (
                <li key={t.name} className="flex flex-col rounded-2xl border border-line bg-surface p-4">
                  <p className="flex items-center gap-2 font-semibold">
                    <Wrench aria-hidden="true" className="size-4 text-signal-ink" />
                    {t.name}
                  </p>
                  <p className="mt-1 text-sm">{t.use}</p>
                  <p className="mt-auto pt-3 text-xs text-muted">
                    <b className="text-ink">Free way to learn:</b> {t.free_option}
                  </p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section id="rm-credentials" icon={Award} title="Licenses and certifications">
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.credentials.map((c) => {
              const required = /required/i.test(c.when);
              return (
                <li key={c.name} className={`rounded-2xl border p-4 ${required ? "border-[#b4532a]/40 bg-[#b4532a]/5" : "border-line bg-surface"}`}>
                  <p className="flex items-start justify-between gap-2">
                    <span className="flex items-center gap-2 font-semibold">
                      <Award aria-hidden="true" className="size-4 shrink-0 text-signal-ink" />
                      {c.name}
                    </span>
                    {required && <span className="shrink-0 rounded-full bg-[#b4532a] px-2 py-0.5 text-xs font-semibold text-white">Required</span>}
                  </p>
                  <p className="mt-1 text-xs text-muted">{c.issuer}</p>
                  <p className="mt-2 text-sm">{c.when}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        <Section id="rm-interview" icon={MessagesSquare} title="Interview questions">
          <div className="grid gap-3">
            {data.interview.map((q, i) =>
              typeof q === "string" ? (
                <p key={q} className="rounded-2xl border border-line bg-surface p-4 text-sm">
                  {q}
                </p>
              ) : (
                <details key={q.question} className="group rounded-2xl border border-line bg-surface p-4 open:border-ink">
                  <summary className="flex cursor-pointer list-none items-start gap-3 font-medium">
                    <span className="grid size-7 shrink-0 place-items-center rounded-full bg-ink-soft text-sm font-bold">Q{i + 1}</span>
                    <span className="pt-0.5">{q.question}</span>
                  </summary>
                  <div className="mt-3 rounded-xl bg-[#2f7d6d]/10 p-3 text-sm">
                    <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-[#2f7d6d] uppercase">
                      <CircleCheck aria-hidden="true" className="size-3.5" /> A strong answer covers
                    </p>
                    {q.strong_answer}
                  </div>
                </details>
              ),
            )}
          </div>
        </Section>

        {data.glossary && data.glossary.length > 0 && (
          <Section id="rm-glossary" icon={BookA} title="Glossary">
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.glossary.map((g) => (
                <div key={g.term} className="rounded-2xl border border-line bg-surface p-4">
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="mt-1 text-sm text-muted">{g.meaning}</dd>
                </div>
              ))}
            </dl>
          </Section>
        )}

        <Section id="rm-mistakes" icon={TriangleAlert} title="Common mistakes to avoid">
          <ul className="grid gap-3 sm:grid-cols-2">
            {data.mistakes.map((m) => (
              <li key={m} className="flex gap-3 rounded-2xl border border-[#b4532a]/30 bg-[#b4532a]/5 p-4 text-sm">
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#b4532a]" />
                {m}
              </li>
            ))}
          </ul>
        </Section>

        <p className="mt-10 text-xs text-muted">
          Built from O*NET occupation data (U.S. Department of Labor, CC BY 4.0) for {data.occupation}. Every link was checked when the roadmap was written.
        </p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <div className="rounded-2xl bg-white/10 p-3">
      <dt className="sr-only">{label}</dt>
      <dd className="font-display text-2xl font-semibold">{value}</dd>
      <dd className="text-xs text-[#c9d2de]">{label}</dd>
    </div>
  );
}

function Section({ id, icon: Icon, title, children }: { id: string; icon: typeof Award; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-12 scroll-mt-32">
      <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-semibold">
        <span className="grid size-9 place-items-center rounded-xl bg-ink text-paper">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

function StageView({ stage: s, index }: { stage: RoadmapStage; index: number }) {
  const a = ACCENTS[index % ACCENTS.length];
  const [open, setOpen] = useState<number | null>(null);
  useEffect(() => setOpen(null), [index]);
  return (
    <div className="mt-5">
      <div className={`rounded-3xl p-5 sm:p-6 ${a.soft}`}>
        <p className={`text-sm font-semibold tracking-wide uppercase ${a.text}`}>Stage {index + 1}</p>
        <h3 className="font-display text-3xl font-semibold">{s.level}</h3>
        <p className="mt-2 flex items-start gap-2 text-[1.05rem]">
          <Target aria-hidden="true" className={`mt-1 size-5 shrink-0 ${a.text}`} />
          {s.goal}
        </p>
        <p className="mt-2 flex items-center gap-2 text-sm text-muted">
          <Clock aria-hidden="true" className="size-4" /> About {duration(Number(s.weeks))} at 8-10 hours a week
        </p>
        {s.plan && s.plan.length > 0 && (
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {s.plan.map((p) => (
              <li key={p.weeks} className="rounded-xl bg-surface p-3 text-sm">
                <span className={`text-xs font-semibold uppercase ${a.text}`}>{p.weeks}</span>
                <p className="mt-0.5">{p.focus}</p>
              </li>
            ))}
          </ol>
        )}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {s.skills.map((k, i) => (
          <button
            key={k.name}
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
            className={`group flex cursor-pointer flex-col rounded-2xl border bg-surface p-4 text-start transition-all hover:-translate-y-0.5 hover:shadow-md ${open === i ? `ring-2 ${a.ring} border-transparent` : "border-line"}`}
          >
            <span className="flex items-center gap-2">
              <span className={`grid size-7 shrink-0 place-items-center rounded-lg text-sm font-bold text-white ${a.bg}`}>{i + 1}</span>
              <span className="font-semibold">{k.name}</span>
            </span>
            <span className="mt-2 line-clamp-3 text-sm text-muted">{k.why}</span>
            <span className={`mt-3 text-sm font-medium ${a.text}`}>{open === i ? "Close" : "Open lesson →"}</span>
          </button>
        ))}
      </div>
      {open !== null && s.skills[open] && <SkillDetail skill={s.skills[open]} n={open + 1} accent={a} onClose={() => setOpen(null)} />}

      <div className="mt-5 grid gap-3 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-3xl bg-ink p-5 text-paper">
          <p className="flex items-center gap-2 text-sm font-medium text-signal">
            <Rocket aria-hidden="true" className="size-4" /> Stage project
          </p>
          <p className="mt-1 font-display text-xl font-semibold">{s.project.title}</p>
          <p className="mt-2 text-sm text-[#dfe5ec]">{s.project.brief}</p>
          {s.project.steps && s.project.steps.length > 0 && (
            <ol className="mt-3 flex flex-col gap-1.5 text-sm text-[#dfe5ec]">
              {s.project.steps.map((x, i) => (
                <li key={x} className="flex gap-2">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-white/15 text-xs font-bold">{i + 1}</span>
                  {x}
                </li>
              ))}
            </ol>
          )}
          <p className="mt-3 rounded-xl bg-white/10 p-3 text-sm">
            <b>Done when:</b> {s.project.done_when}
          </p>
        </div>
        {s.evidence && s.evidence.length > 0 && (
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="flex items-center gap-2 font-semibold">
              <Trophy aria-hidden="true" className="size-4 text-signal-ink" /> Show employers
            </p>
            <ul className="mt-2 flex flex-col gap-2 text-sm">
              {s.evidence.map((e) => (
                <li key={e} className="flex gap-2">
                  <CircleCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-[#2f7d6d]" />
                  {e}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

const KIND_ICON: Record<string, typeof Award> = { video: CirclePlay, course: GraduationCap, docs: FileText, article: FileText, book: BookOpen, practice: Dumbbell, tool: Wrench };

function SkillDetail({ skill: k, n, accent: a, onClose }: { skill: RoadmapSkill; n: number; accent: (typeof ACCENTS)[number]; onClose: () => void }) {
  return (
    <div className={`mt-3 rounded-3xl border-2 bg-surface p-5 sm:p-6 ${a.border}`}>
      <div className="flex items-start justify-between gap-3">
        <h4 className="flex items-center gap-2 font-display text-xl font-semibold">
          <span className={`grid size-8 shrink-0 place-items-center rounded-lg text-sm font-bold text-white ${a.bg}`}>{n}</span>
          {k.name}
        </h4>
        <button type="button" onClick={onClose} aria-label="Close lesson" className="grid size-9 shrink-0 cursor-pointer place-items-center rounded-full hover:bg-ink-soft">
          <X aria-hidden="true" className="size-5" />
        </button>
      </div>
      <p className="mt-2 text-muted">{k.why}</p>

      {k.lesson && (
        <div className={`mt-4 rounded-2xl p-4 ${a.soft}`}>
          <p className={`mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase ${a.text}`}>
            <Lightbulb aria-hidden="true" className="size-4" /> Teacher&apos;s note
          </p>
          <p className="leading-relaxed">{k.lesson}</p>
        </div>
      )}

      {k.subtopics && k.subtopics.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <ListChecks aria-hidden="true" className="size-4" /> What to learn
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {k.subtopics.map((t) => (
              <li key={t} className="rounded-full bg-ink-soft px-3 py-1 text-sm">
                {t}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {(k.drill?.length || k.practice) && (
          <div className="rounded-2xl border border-line p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Dumbbell aria-hidden="true" className="size-4" /> Practice drill
            </p>
            {k.drill?.length ? (
              <ol className="flex flex-col gap-1.5 text-sm">
                {k.drill.map((d, i) => (
                  <li key={d} className="flex gap-2">
                    <span className={`grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold text-white ${a.bg}`}>{i + 1}</span>
                    {d}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm">{k.practice}</p>
            )}
          </div>
        )}
        <div className="flex flex-col gap-3">
          {k.ready_when && (
            <div className="rounded-2xl bg-[#2f7d6d]/10 p-4 text-sm">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-[#2f7d6d]">
                <CircleCheck aria-hidden="true" className="size-4" /> You&apos;re ready when
              </p>
              {k.ready_when}
            </div>
          )}
          {k.pitfalls && k.pitfalls.length > 0 && (
            <div className="rounded-2xl bg-[#b4532a]/8 p-4 text-sm">
              <p className="mb-1 flex items-center gap-1.5 font-semibold text-[#b4532a]">
                <TriangleAlert aria-hidden="true" className="size-4" /> Watch out for
              </p>
              <ul className="flex flex-col gap-1">
                {k.pitfalls.map((p) => (
                  <li key={p}>• {p}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>

      {k.check && k.check.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
            <CircleHelp aria-hidden="true" className="size-4" /> Check yourself
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {k.check.map((c) => (
              <details key={c.q} className="rounded-2xl border border-line p-3 text-sm open:bg-ink-soft">
                <summary className="cursor-pointer list-none font-medium">{c.q}</summary>
                <p className="mt-2">{c.a}</p>
              </details>
            ))}
          </div>
        </div>
      )}

      {k.resources.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-sm font-semibold">Free resources</p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {k.resources.map((r: Resource) => {
              const Icon = KIND_ICON[r.kind] ?? ExternalLink;
              return (
                <li key={r.url}>
                  <a href={r.url} target="_blank" rel="noopener noreferrer" className="flex items-start gap-3 rounded-2xl border border-line p-3 transition-colors hover:border-ink">
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${a.soft}`}>
                      <Icon aria-hidden="true" className={`size-4 ${a.text}`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{r.title}</span>
                      <span className="block text-xs text-muted">
                        {r.provider} · {r.kind}
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
