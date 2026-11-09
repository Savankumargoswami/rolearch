import { ArrowDownRight, ArrowUpRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { t, type MessageKey } from "@/i18n";
import { monthName, type Report, type SkillShare } from "@/lib/skills-report";

const pct = (x: number) => `${x >= 0.1 ? Math.round(x * 100) : (x * 100).toFixed(1)}%`;
const pts = (x: number) => `${x > 0 ? "+" : ""}${(x * 100).toFixed(1)} pts`;
const ld = (o: unknown) => JSON.stringify(o).replace(/</g, "\\u003c");
const industry = (c: string) => t(`categories.${c}` as MessageKey);

function Bars({ items, showChange }: { items: SkillShare[]; showChange: boolean }) {
  const top = Math.max(...items.map((s) => s.share), 0.01);
  return (
    <ol className="mt-4 flex flex-col gap-2">
      {items.map((s, i) => (
        <li key={s.skill} className="grid grid-cols-[1.75rem_minmax(7rem,11rem)_1fr_3.25rem] items-center gap-3 text-[0.95rem] sm:grid-cols-[1.75rem_minmax(7rem,12rem)_1fr_3.25rem_5.5rem]">
          <span className="text-end text-sm tabular-nums text-muted">{i + 1}</span>
          <span className="truncate font-medium">{s.skill}</span>
          <span className="h-2.5 rounded-full bg-ink-soft">
            <span className="block h-full rounded-full bg-ink" style={{ width: `${(s.share / top) * 100}%` }} />
          </span>
          <span className="text-end tabular-nums">{pct(s.share)}</span>
          {showChange && s.prev !== null ? (
            <span className={`hidden text-end text-xs tabular-nums sm:block ${s.share >= s.prev ? "text-[#1f7a4d]" : "text-[#b4532a]"}`}>{pts(s.share - s.prev)}</span>
          ) : (
            showChange && <span className="hidden sm:block" />
          )}
        </li>
      ))}
    </ol>
  );
}

/** The Rolearch Skills Report for one month: most-asked skills, AI demand by industry, top skills per industry, movers. */
export function SkillsReportView({ r, months }: { r: Report; months: string[] }) {
  const name = monthName(r.month);
  const url = `https://www.rolearch.com/reports/skills/${r.month}`;
  const jobs = r.jobs.toLocaleString("en-US");
  const hasPrev = r.prevMonth !== null;
  const lead = `Rolearch read ${jobs} open job postings in ${name}. ${pct(r.ai)} asked for at least one AI skill, and the most-requested skill was ${r.top[0]?.skill ?? "n/a"}, in ${pct(r.top[0]?.share ?? 0)} of postings.`;
  const aiTop = r.industries.slice(0, 3);

  return (
    <article className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: ld({
            "@context": "https://schema.org",
            "@type": "Dataset",
            name: `Rolearch Skills Report, ${name}`,
            description: lead,
            url,
            creator: { "@type": "Organization", name: "Rolearch", url: "https://www.rolearch.com" },
            temporalCoverage: `${r.month}`,
            dateModified: r.updatedAt,
            isAccessibleForFree: true,
            license: "https://creativecommons.org/licenses/by/4.0/",
            variableMeasured: ["Share of job postings asking for each skill", "Share of job postings asking for AI skills, by industry"],
          }),
        }}
      />
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">Rolearch Skills Report</p>
      <h1 className="mt-1 font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-5xl">The skills employers asked for in {name}</h1>
      <p className="mt-3 max-w-[64ch] text-lg text-muted text-pretty">{lead}</p>

      <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <dt className="text-sm text-muted">Postings read</dt>
          <dd className="font-display text-3xl font-semibold tabular-nums">{jobs}</dd>
        </div>
        <div className="rounded-2xl border border-line bg-surface px-4 py-3">
          <dt className="text-sm text-muted">Ask for an AI skill</dt>
          <dd className="font-display text-3xl font-semibold tabular-nums">{pct(r.ai)}</dd>
        </div>
        <div className="col-span-2 rounded-2xl border border-line bg-surface px-4 py-3 sm:col-span-1">
          <dt className="text-sm text-muted">Industries covered</dt>
          <dd className="font-display text-3xl font-semibold tabular-nums">{r.industries.length}</dd>
        </div>
      </dl>

      <section aria-labelledby="top-h" className="mt-12">
        <h2 id="top-h" className="font-display text-2xl font-semibold">
          The 25 most-asked skills
        </h2>
        <p className="mt-1 text-sm text-muted">
          Share of all postings that ask for each skill{hasPrev ? `, and the change since ${monthName(r.prevMonth!)}` : ""}.
        </p>
        <Bars items={r.top} showChange={hasPrev} />
      </section>

      {hasPrev && (r.rising.length > 0 || r.falling.length > 0) && (
        <section aria-labelledby="move-h" className="mt-12 grid gap-6 sm:grid-cols-2">
          <h2 id="move-h" className="sr-only">
            Rising and falling skills
          </h2>
          {[
            { title: "Rising", list: r.rising, Icon: ArrowUpRight, tone: "text-[#1f7a4d]" },
            { title: "Falling", list: r.falling, Icon: ArrowDownRight, tone: "text-[#b4532a]" },
          ].map(({ title, list, Icon, tone }) => (
            <div key={title} className="rounded-2xl border border-line bg-surface p-4">
              <h3 className={`flex items-center gap-1.5 font-semibold ${tone}`}>
                <Icon aria-hidden="true" className="size-4" />
                {title}
              </h3>
              <ul className="mt-2 divide-y divide-line">
                {list.map((s) => (
                  <li key={s.skill} className="flex justify-between gap-3 py-1.5 text-[0.95rem]">
                    <span>{s.skill}</span>
                    <span className="tabular-nums text-muted">
                      {pct(s.prev!)} → {pct(s.share)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      <section aria-labelledby="ai-h" className="mt-12">
        <h2 id="ai-h" className="flex items-center gap-2 font-display text-2xl font-semibold">
          <Sparkles aria-hidden="true" className="size-6 text-signal-ink" />
          AI skills, industry by industry
        </h2>
        <p className="mt-1 max-w-[64ch] text-sm text-muted">
          Share of each industry&rsquo;s postings asking for machine learning, deep learning, LLMs, NLP, computer vision, MLOps, PyTorch, TensorFlow or
          scikit-learn.{aiTop.length ? ` Highest: ${aiTop.map((x) => `${industry(x.category)} (${pct(x.ai)})`).join(", ")}.` : ""}
        </p>
        <ul className="mt-4 flex flex-col gap-2">
          {r.industries.map((x) => (
            <li key={x.category} className="grid grid-cols-[minmax(8rem,13rem)_1fr_3.25rem] items-center gap-3 text-[0.95rem]">
              <span className="truncate">{industry(x.category)}</span>
              <span className="h-2.5 rounded-full bg-ink-soft">
                <span className="block h-full rounded-full bg-signal" style={{ width: `${(x.ai / Math.max(r.industries[0]?.ai ?? 0, 0.01)) * 100}%` }} />
              </span>
              <span className="text-end tabular-nums">{pct(x.ai)}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="ind-h" className="mt-12">
        <h2 id="ind-h" className="font-display text-2xl font-semibold">
          Top skills in each industry
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[...r.industries]
            .sort((a, b) => b.jobs - a.jobs)
            .map((x) => (
              <section key={x.category} className="rounded-2xl border border-line bg-surface p-4">
                <h3 className="flex items-baseline justify-between gap-3 font-semibold">
                  {industry(x.category)}
                  <span className="text-xs font-normal tabular-nums text-muted">{x.jobs.toLocaleString("en-US")} postings</span>
                </h3>
                <ol className="mt-2 flex flex-col gap-1 text-[0.95rem]">
                  {x.top.map((s, i) => (
                    <li key={s.skill} className="flex justify-between gap-3">
                      <span>
                        <span className="tabular-nums text-muted">{i + 1}.</span> {s.skill}
                      </span>
                      <span className="tabular-nums text-muted">{pct(s.share)}</span>
                    </li>
                  ))}
                </ol>
              </section>
            ))}
        </div>
      </section>

      <section aria-labelledby="method-h" className="mt-12 rounded-2xl border border-line bg-surface p-5">
        <h2 id="method-h" className="font-display text-xl font-semibold">
          How this is measured
        </h2>
        <p className="mt-2 text-[0.95rem] text-muted">
          Rolearch lists jobs from employers&rsquo; own career pages. Each open posting with a full description is read against a dictionary of 194
          skills across every industry, matched carefully so boilerplate (&ldquo;we offer mental health benefits&rdquo;) doesn&rsquo;t count. A
          posting counts once per skill. Shares are of postings read that month; the current month updates nightly. Explore any role on{" "}
          <Link href="/careers" className="font-medium text-ink underline underline-offset-4">
            Career paths
          </Link>
          .
        </p>
        <p className="mt-4 text-sm font-semibold">Cite this report</p>
        <p className="mt-1 rounded-xl bg-ink-soft px-3 py-2 font-mono text-[0.8rem] break-words">
          Rolearch Skills Report, {name}. {url}
        </p>
        <p className="mt-2 text-xs text-muted">Free to quote and republish with a link to this page (CC BY 4.0).</p>
      </section>

      {months.length > 1 && (
        <nav aria-label="Other months" className="mt-8 flex flex-wrap gap-2 text-sm">
          <span className="text-muted">Other months:</span>
          {months
            .filter((m) => m !== r.month)
            .map((m) => (
              <Link key={m} href={`/reports/skills/${m}`} className="underline underline-offset-4">
                {monthName(m)}
              </Link>
            ))}
        </nav>
      )}
    </article>
  );
}
