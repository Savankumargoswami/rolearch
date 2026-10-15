import { ArrowUpRight, Award, BriefcaseBusiness, FolderGit2, GraduationCap, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { t } from "@/i18n";
import { formatMonths } from "@/lib/expertise";
import type { ProfileData } from "@/lib/profile-schema";

const fmtMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1)) : ym;
};
const toMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};

/** Numbers that carry the story in a bullet: 99.6%, $42K/month, 180+, 2K, 3x. */
const METRIC = /(\$\d[\d,.]*[KMB]?(?:\/[a-z]+)?|\d[\d,.]*\s?%|\d[\d,.]*[KMB]?\+|\d[\d,.]*[KMB](?![a-z])|\d[\d,.]*x(?![a-z]))/g;

function Highlighted({ text }: { text: string }) {
  return (
    <>
      {text.split(METRIC).map((part, i) =>
        i % 2 === 1 ? (
          <strong key={i} className="rounded-md bg-signal/20 px-1 font-semibold text-ink">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

const initialsOf = (name: string) =>
  name
    .replace(/,?\s+(inc|llc|ltd|gmbh|corp|co)\.?$/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "•";

/** The one-page resume, laid out to be read: a role timeline on the left, quick facts on the right. */
export function ResumeView({ resume: r }: { resume: ProfileData["resume"] }) {
  const nowDate = new Date();
  const nowMonth = nowDate.getUTCFullYear() * 12 + nowDate.getUTCMonth();
  const span = (start: string, end: string, current: boolean) => {
    const s = toMonth(start);
    const e = current || !end ? nowMonth : toMonth(end);
    return s == null || e == null || e < s ? "" : formatMonths(e - s + 1);
  };
  const hasSide = r.skills.length + r.certifications.length + r.education.length > 0;

  return (
    <section aria-labelledby="resume-h" className="mt-10">
      <h2 id="resume-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
        {t("profile.resumeLabel")}
      </h2>
      <div className={`mt-5 grid items-start gap-5 ${hasSide ? "md:grid-cols-[minmax(0,1fr)_17.5rem]" : ""}`}>
        <div className="flex min-w-0 flex-col gap-5">
          {r.experience.length > 0 && (
            <Card icon={BriefcaseBusiness} title={t("profile.experience")} note={t("profile.rolesCount", { n: r.experience.length })}>
              <ol className="mt-6">
                {r.experience.map((e, i) => {
                  const last = i === r.experience.length - 1;
                  return (
                    <li key={i} className={`relative ps-14 ${last ? "" : "pb-8"}`}>
                      {!last && <span aria-hidden="true" className="absolute start-[19px] top-12 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-line to-transparent" />}
                      <span
                        aria-hidden="true"
                        className={`absolute start-0 top-0 grid size-10 place-items-center rounded-xl font-display text-sm font-semibold ${
                          e.current ? "bg-signal text-ink shadow-[0_0_0_4px_rgba(224,163,91,0.2)]" : "bg-ink text-paper"
                        }`}
                      >
                        {initialsOf(e.company || e.title)}
                      </span>
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0">
                          <h4 className="font-display text-lg font-semibold leading-snug tracking-[-0.01em]">{e.title}</h4>
                          <p className="text-[0.95rem]">
                            {e.company && <span className="font-medium">{e.company}</span>}
                            {e.company && e.location && <span className="text-muted"> · </span>}
                            {e.location && <span className="text-muted">{e.location}</span>}
                          </p>
                        </div>
                        <div className="flex flex-col items-start gap-1 sm:items-end">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums ${e.current ? "bg-signal/20 text-ink" : "bg-ink-soft"}`}>
                            {e.current && (
                              <span aria-hidden="true" className="relative flex size-2">
                                <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-60" />
                                <span className="relative inline-flex size-2 rounded-full bg-signal" />
                              </span>
                            )}
                            {[fmtMonth(e.start), e.current ? t("profile.present") : fmtMonth(e.end)].filter(Boolean).join(" – ")}
                          </span>
                          {span(e.start, e.end, e.current) && <span className="text-xs tabular-nums text-muted">{span(e.start, e.end, e.current)}</span>}
                        </div>
                      </div>
                      {e.bullets.length > 0 && (
                        <ul className="mt-3 flex flex-col gap-2">
                          {e.bullets.map((b, j) => (
                            <li key={j} className="flex gap-3 leading-relaxed">
                              <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-signal" />
                              <span className="min-w-0">
                                <Highlighted text={b} />
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                      {e.skills.length > 0 && <Chips items={e.skills} className="mt-3" />}
                    </li>
                  );
                })}
              </ol>
            </Card>
          )}

          {r.projects.length > 0 && (
            <Card icon={FolderGit2} title={t("profile.projects")}>
              <ul className="mt-5 grid gap-3 sm:grid-cols-2">
                {r.projects.map((pr, i) => (
                  <li key={i} className="group flex flex-col rounded-2xl border border-line bg-paper/50 p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-ink">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-display font-semibold leading-snug">{pr.name}</h4>
                      {pr.url && (
                        <a
                          href={pr.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`${pr.name}: ${t("profile.link")}`}
                          className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-paper transition-transform duration-200 group-hover:rotate-45"
                        >
                          <ArrowUpRight aria-hidden="true" className="size-4" />
                        </a>
                      )}
                    </div>
                    {pr.summary && (
                      <p className="mt-1.5 text-[0.95rem] leading-relaxed text-ink/85">
                        <Highlighted text={pr.summary} />
                      </p>
                    )}
                    {pr.skills.length > 0 && <Chips items={pr.skills} className="mt-auto pt-3" />}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        {hasSide && (
          <aside className="flex min-w-0 flex-col gap-5 md:sticky md:top-20">
            {r.skills.length > 0 && (
              <Card icon={Sparkles} title={t("profile.skills")} compact>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {r.skills.map((s, i) => (
                    <li
                      key={s}
                      className={`rounded-full px-3 py-1 text-sm ${i < 5 ? "bg-ink font-medium text-paper" : "border border-line bg-surface"}`}
                    >
                      {s}
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {r.certifications.length > 0 && (
              <Card icon={Award} title={t("profile.certifications")} compact>
                <ul className="mt-4 flex flex-col gap-3">
                  {r.certifications.map((c, i) => (
                    <li key={i} className="flex gap-3 rounded-xl bg-paper/60 p-3">
                      <span aria-hidden="true" className="grid size-9 shrink-0 place-items-center rounded-lg bg-signal/20 text-signal-ink">
                        <Award className="size-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-semibold leading-snug">
                          {c.url ? (
                            <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4 hover:decoration-ink">
                              {c.name}
                            </a>
                          ) : (
                            c.name
                          )}
                        </span>
                        <span className="mt-0.5 block text-sm text-muted">{[c.issuer, fmtMonth(c.issued)].filter(Boolean).join(" · ")}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {r.education.length > 0 && (
              <Card icon={GraduationCap} title={t("profile.education")} compact>
                <ul className="mt-4 flex flex-col gap-4">
                  {r.education.map((e, i) => (
                    <li key={i} className="border-s-2 border-signal ps-3">
                      <p className="font-semibold leading-snug">{[e.degree, e.field].filter(Boolean).join(", ")}</p>
                      {e.school && <p className="mt-0.5 text-sm">{e.school}</p>}
                      {(e.start || e.end) && <p className="mt-0.5 text-sm tabular-nums text-muted">{[e.start, e.end].filter(Boolean).join(" – ")}</p>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        )}
      </div>
    </section>
  );
}

function Card({ icon: Icon, title, note, compact, children }: { icon: LucideIcon; title: string; note?: string; compact?: boolean; children: React.ReactNode }) {
  return (
    <div className={`rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgba(14,31,47,0.04),0_8px_24px_-12px_rgba(14,31,47,0.12)] ${compact ? "p-5" : "p-5 sm:p-7"}`}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-xl bg-ink-soft text-ink">
          <Icon className="size-[18px]" />
        </span>
        <h3 className="font-display text-lg font-semibold tracking-[-0.01em]">{title}</h3>
        {note && <span className="ms-auto text-sm text-muted">{note}</span>}
      </div>
      {children}
    </div>
  );
}

function Chips({ items, className = "" }: { items: string[]; className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`}>
      {items.map((s) => (
        <li key={s} className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs font-medium text-ink/80">
          {s}
        </li>
      ))}
    </ul>
  );
}
