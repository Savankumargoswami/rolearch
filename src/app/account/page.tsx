import { ArrowUpRight, CircleAlert, CircleCheck, FileUp, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { t } from "@/i18n";
import { expertiseOf, formatMonths, totalMonths } from "@/lib/expertise";
import { loadAccount, type AccountProfile } from "@/lib/profile";

export const metadata: Metadata = { title: t("auth.accountTitle"), robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <Account />
      </Suspense>
    </div>
  );
}

const fmtMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1)) : ym;
};

/** Reads the signed-in user, so it streams in behind the Suspense boundary. */
async function Account() {
  const account = await loadAccount();
  const { profile: p } = account;
  const r = p.resume;
  const hasResume = r.experience.length + r.education.length + r.projects.length + r.certifications.length + r.skills.length > 0;
  const expertise = expertiseOf(p);
  const top = expertise.filter((e) => e.source === "experience").slice(0, 3);
  const more = expertise.filter((e) => !top.includes(e)).slice(0, 10);
  const years = totalMonths(p);
  const statusLine = p.status === "student" ? t("profile.student") : years ? `${t("profile.professional")} · ${formatMonths(years)}` : t("profile.professional");

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{p.full_name || t("auth.accountTitle")}</h1>
          {p.headline && <p className="mt-2 text-lg">{p.headline}</p>}
          <p className="mt-1 text-muted">{[p.location, statusLine].filter(Boolean).join(" · ")}</p>
          {p.links.some((l) => l.url) && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {p.links
                .filter((l) => l.url)
                .map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline decoration-line underline-offset-4 hover:decoration-ink">
                      {l.label || l.url}
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                  </li>
                ))}
            </ul>
          )}
        </div>
        <Link href="/account/profile" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover">
          <Pencil aria-hidden="true" className="size-4" />
          {hasResume ? t("profile.edit") : t("profile.build")}
        </Link>
      </div>

      {!hasResume && account.accountType === "seeker" && (
        <Link href="/account/profile" className="mt-8 flex items-start gap-4 rounded-2xl border border-dashed border-muted/60 bg-surface p-6 hover:border-ink">
          <FileUp aria-hidden="true" className="mt-1 size-6 shrink-0" />
          <span>
            <span className="block font-display text-xl font-semibold">{t("profile.emptyTitle")}</span>
            <span className="mt-1 block text-muted">{t("profile.emptyBody")}</span>
          </span>
        </Link>
      )}

      {top.length > 0 && (
        <section aria-labelledby="expertise-h" className="mt-10">
          <h2 id="expertise-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("profile.expertise")}
          </h2>
          <p className="text-sm text-muted">{t("profile.expertiseHint")}</p>
          <ul className="mt-4 grid gap-3 sm:grid-cols-3">
            {top.map((e) => (
              <li key={e.skill} className="rounded-2xl bg-ink p-4 text-paper">
                <span className="block font-display text-lg font-semibold">{e.skill}</span>
                <span className="block tabular-nums text-[#c9d2de]">{formatMonths(e.months)}</span>
              </li>
            ))}
          </ul>
          {more.length > 0 && (
            <ul className="mt-3 flex flex-wrap gap-2">
              {more.map((e) => (
                <li key={e.skill} className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm">
                  <span className="font-medium">{e.skill}</span>
                  <span className="text-muted"> · {e.source === "projects" ? t("profile.fromProjects") : formatMonths(e.months)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {hasResume && (
        <article aria-label={t("profile.resumeLabel")} className="mt-10 rounded-sm border border-line bg-surface p-6 sm:p-10">
          <div className="grid gap-8 md:grid-cols-[1fr_15rem]">
            <div className="min-w-0">
              {r.experience.length > 0 && (
                <ResumeSection title={t("profile.experience")}>
                  {r.experience.map((e, i) => (
                    <div key={i} className="mb-5">
                      <div className="flex flex-wrap justify-between gap-x-4">
                        <p>
                          <strong>{e.title}</strong>
                          {e.company && <span>, {e.company}</span>}
                        </p>
                        <p className="text-sm tabular-nums text-muted">
                          {[fmtMonth(e.start), e.current ? t("profile.present") : fmtMonth(e.end)].filter(Boolean).join(" – ")}
                        </p>
                      </div>
                      {e.location && <p className="text-sm text-muted">{e.location}</p>}
                      {e.bullets.length > 0 && (
                        <ul className="mt-1.5 list-disc space-y-1 ps-5 marker:text-muted">
                          {e.bullets.map((b, j) => (
                            <li key={j}>{b}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </ResumeSection>
              )}
              {r.projects.length > 0 && (
                <ResumeSection title={t("profile.projects")}>
                  {r.projects.map((pr, i) => (
                    <div key={i} className="mb-4">
                      <p>
                        <strong>{pr.name}</strong>
                        {pr.url && (
                          <a href={pr.url} target="_blank" rel="noopener noreferrer" className="ms-2 text-sm underline decoration-line underline-offset-4">
                            {t("profile.link")}
                          </a>
                        )}
                      </p>
                      {pr.summary && <p>{pr.summary}</p>}
                      {pr.skills.length > 0 && <p className="text-sm text-muted">{pr.skills.join(", ")}</p>}
                    </div>
                  ))}
                </ResumeSection>
              )}
            </div>
            <div className="min-w-0">
              {r.skills.length > 0 && (
                <ResumeSection title={t("profile.skills")}>
                  <p className="leading-relaxed">{r.skills.join(", ")}</p>
                </ResumeSection>
              )}
              {r.certifications.length > 0 && (
                <ResumeSection title={t("profile.certifications")}>
                  {r.certifications.map((c, i) => (
                    <div key={i} className="mb-3">
                      <p className="font-medium">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noopener noreferrer" className="underline decoration-line underline-offset-4">
                            {c.name}
                          </a>
                        ) : (
                          c.name
                        )}
                      </p>
                      <p className="text-sm text-muted">{[c.issuer, fmtMonth(c.issued)].filter(Boolean).join(" · ")}</p>
                    </div>
                  ))}
                </ResumeSection>
              )}
              {r.education.length > 0 && (
                <ResumeSection title={t("profile.education")}>
                  {r.education.map((e, i) => (
                    <div key={i} className="mb-3">
                      <p className="font-medium">{[e.degree, e.field].filter(Boolean).join(", ")}</p>
                      <p className="text-sm text-muted">{[e.school, [e.start, e.end].filter(Boolean).join("–")].filter(Boolean).join(" · ")}</p>
                    </div>
                  ))}
                </ResumeSection>
              )}
            </div>
          </div>
        </article>
      )}

      <AccountFacts account={account} />

      <form action={signOut} className="mt-8">
        <button type="submit" className="min-h-12 cursor-pointer rounded-full border border-ink px-6 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
          {t("auth.signOut")}
        </button>
      </form>
    </>
  );
}

function ResumeSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-3 border-b border-ink pb-1 text-sm font-semibold tracking-wide text-signal-ink">{title}</h3>
      {children}
    </section>
  );
}

function AccountFacts({ account }: { account: AccountProfile }) {
  const company = account.accountType === "company";
  return (
    <section aria-labelledby="account-h" className="mt-10">
      <h2 id="account-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
        {t("profile.accountDetails")}
      </h2>
      <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface px-6">
        <Row label={t("auth.accountEmail")} value={account.email} />
        <Row label={t("auth.accountType")} value={company ? t("auth.accountCompany") : t("auth.accountSeeker")} />
        {company && <Row label={t("auth.accountCompanyName")} value={account.companyName} />}
        {company && <Row label={t("auth.accountWebsite")} value={account.website} />}
      </dl>
      {company && (
        <p className="mt-4 flex items-start gap-2 text-[0.95rem]">
          {account.companyDomainMatches ? (
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-signal-ink" />
          )}
          {account.companyDomainMatches ? t("auth.accountDomainOk") : t("auth.accountDomainNo")}
        </p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}
