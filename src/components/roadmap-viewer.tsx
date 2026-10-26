"use client";

import { Check, ChevronDown, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { loadRoadmap } from "@/app/roadmaps/actions";
import type { Roadmap, RoadmapSkill } from "@/lib/roadmaps";

// Members-only roadmap, with the protections a web page can offer: it loads after the page (not in the HTML), can't be
// selected, copied, printed or saved with the usual shortcuts, blurs when the window loses focus or a screenshot key is
// pressed, and carries a faint Rolearch watermark. A screenshot tool or a phone camera can't be stopped by any website;
// the watermark marks any shared copy as Rolearch's.

export function RoadmapViewer({ slug }: { slug: string }) {
  const [data, setData] = useState<Roadmap | null | undefined>(undefined);
  const [hidden, setHidden] = useState(false);

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

  return (
    <div className="roadmap-protected relative mt-8 select-none" style={{ WebkitUserSelect: "none" }}>
      <style>{`@media print { .roadmap-protected { display: none !important; } body::after { content: "Roadmaps are available on Rolearch."; font: 20px sans-serif; } }`}</style>
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-10" style={{ backgroundImage: watermark }} />
      <div className={`transition-[filter] duration-200 ${hidden ? "blur-xl" : ""}`}>
        <p className="max-w-[70ch] text-lg">{data.summary}</p>

        {data.ladder && data.ladder.length > 0 && (
          <section className="mt-8">
            <h2 className="font-display text-2xl font-semibold">Career ladder</h2>
            <ol className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.ladder.map((l) => (
                <li key={l.title} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-semibold">{l.title}</p>
                  <p className="text-muted">{l.years}</p>
                  <p className="mt-1">{l.moves_you_up}</p>
                </li>
              ))}
            </ol>
          </section>
        )}

        {data.stages.map((s, i) => (
          <section key={s.level} className="mt-10 border-t-2 border-ink pt-4">
            <p className="text-sm font-semibold tracking-wide text-signal-ink uppercase">
              Stage {i + 1} · about {s.weeks} weeks part-time
            </p>
            <h2 className="font-display text-2xl font-semibold">{s.level}</h2>
            <p className="mt-1">{s.goal}</p>
            {s.plan && s.plan.length > 0 && (
              <details className="mt-3 rounded-xl bg-ink-soft p-3 text-sm">
                <summary className="cursor-pointer font-medium">Week-by-week plan</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {s.plan.map((p) => (
                    <li key={p.weeks}>
                      <b>{p.weeks}:</b> {p.focus}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            <div className="mt-4 flex flex-col gap-3">
              {s.skills.map((k) => (
                <Skill key={k.name} skill={k} />
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-ink p-4 text-paper">
              <p className="text-sm text-[#c9d2de]">Stage project</p>
              <p className="font-display text-lg font-semibold">{s.project.title}</p>
              <p className="mt-1 text-sm text-[#dfe5ec]">{s.project.brief}</p>
              {s.project.steps && (
                <ol className="mt-2 list-decimal ps-5 text-sm text-[#dfe5ec]">
                  {s.project.steps.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ol>
              )}
              <p className="mt-2 text-sm">
                <b>Done when:</b> {s.project.done_when}
              </p>
            </div>
            {s.evidence && s.evidence.length > 0 && (
              <p className="mt-3 text-sm">
                <b>Show employers:</b> {s.evidence.join(" · ")}
              </p>
            )}
          </section>
        ))}

        {data.tools && data.tools.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Tools of the trade</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {data.tools.map((t) => (
                <li key={t.name} className="rounded-xl border border-line p-3 text-sm">
                  <p className="font-semibold">{t.name}</p>
                  <p>{t.use}</p>
                  <p className="mt-1 text-muted">Free way to learn: {t.free_option}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Licenses and certifications</h2>
          <ul className="mt-3 flex flex-col gap-2 text-sm">
            {data.credentials.map((c) => (
              <li key={c.name}>
                <b>{c.name}</b> ({c.issuer}): {c.when}
              </li>
            ))}
          </ul>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Interview questions</h2>
          <div className="mt-3 flex flex-col gap-2">
            {data.interview.map((q) =>
              typeof q === "string" ? (
                <p key={q} className="text-sm">
                  {q}
                </p>
              ) : (
                <details key={q.question} className="rounded-xl border border-line p-3 text-sm">
                  <summary className="cursor-pointer font-medium">{q.question}</summary>
                  <p className="mt-2">{q.strong_answer}</p>
                </details>
              ),
            )}
          </div>
        </section>

        {data.glossary && data.glossary.length > 0 && (
          <section className="mt-10">
            <h2 className="font-display text-2xl font-semibold">Glossary</h2>
            <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
              {data.glossary.map((g) => (
                <div key={g.term}>
                  <dt className="font-semibold">{g.term}</dt>
                  <dd className="text-muted">{g.meaning}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}

        <section className="mt-10">
          <h2 className="font-display text-2xl font-semibold">Common mistakes</h2>
          <ul className="mt-3 list-disc ps-5 text-sm">
            {data.mistakes.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </section>

        <p className="mt-10 text-xs text-muted">
          Built from O*NET occupation data (U.S. Department of Labor, CC BY 4.0) for {data.occupation}. Every link was checked when the roadmap was written.
        </p>
      </div>
    </div>
  );
}

function Skill({ skill: k }: { skill: RoadmapSkill }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full cursor-pointer items-start justify-between gap-3 text-start">
        <span>
          <span className="block font-semibold">{k.name}</span>
          <span className="block text-sm text-muted">{k.why}</span>
        </span>
        <ChevronDown aria-hidden="true" className={`mt-1 size-5 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          {k.lesson && <p className="rounded-xl bg-ink-soft p-3 leading-relaxed">{k.lesson}</p>}
          {k.subtopics && k.subtopics.length > 0 && (
            <p>
              <b>Learn:</b> {k.subtopics.join(" · ")}
            </p>
          )}
          {k.drill && k.drill.length > 0 ? (
            <div>
              <b>Practice drill</b>
              <ol className="mt-1 list-decimal ps-5">
                {k.drill.map((d) => (
                  <li key={d}>{d}</li>
                ))}
              </ol>
            </div>
          ) : (
            k.practice && (
              <p>
                <b>Practice:</b> {k.practice}
              </p>
            )
          )}
          {k.ready_when && (
            <p className="flex gap-1.5">
              <Check aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal-ink" />
              <span>
                <b>You&apos;re ready when:</b> {k.ready_when}
              </span>
            </p>
          )}
          {k.pitfalls && k.pitfalls.length > 0 && (
            <p>
              <b>Watch out for:</b> {k.pitfalls.join(" · ")}
            </p>
          )}
          {k.check && k.check.length > 0 && (
            <details className="rounded-xl border border-line p-3">
              <summary className="cursor-pointer font-medium">Check yourself</summary>
              {k.check.map((c) => (
                <p key={c.q} className="mt-2">
                  <b>Q:</b> {c.q}
                  <br />
                  <b>A:</b> {c.a}
                </p>
              ))}
            </details>
          )}
          {k.resources.length > 0 && (
            <div>
              <b>Free resources</b>
              <ul className="mt-1 flex flex-col gap-1">
                {k.resources.map((r) => (
                  <li key={r.url}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">
                      {r.title}
                    </a>{" "}
                    <span className="text-muted">
                      ({r.provider}, {r.kind})
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
