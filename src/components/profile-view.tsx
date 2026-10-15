import { ArrowUpRight, Camera, CircleAlert, CircleCheck, FileUp, MapPin, Pencil } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { PostComposer } from "@/components/post-composer";
import { PostList } from "@/components/post-card";
import { t } from "@/i18n";
import { expertiseOf, formatMonths, totalMonths } from "@/lib/expertise";
import type { AccountProfile } from "@/lib/profile";
import type { ProfileData } from "@/lib/profile-schema";
import type { Post, Social } from "@/lib/social";

const fmtMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1)) : ym;
};
const toMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? Number(m[1]) * 12 + Number(m[2]) - 1 : null;
};
const compact = new Intl.NumberFormat("en", { notation: "compact" });

type Props = {
  account: AccountProfile;
  /** "own": the signed-in member's profile (edit, compose, account details). "public": someone else's. */
  mode: "own" | "public";
  social: Social;
  posts: Post[];
  viewerId: string;
  canPost?: boolean;
};

/** A member's profile: photo, name and experience up top, then skills, career, posts and the one-page resume. */
export function ProfileView({ account, mode, social, posts, viewerId, canPost = false }: Props) {
  const own = mode === "own";
  const { profile: p } = account;
  const r = p.resume;
  const hasResume = r.experience.length + r.education.length + r.projects.length + r.certifications.length + r.skills.length > 0;
  const expertise = expertiseOf(p);
  const fromRoles = expertise.filter((e) => e.source === "experience");
  const bars = fromRoles.slice(0, 8);
  const projectSkills = expertise.filter((e) => e.source === "projects").slice(0, 12);
  const years = totalMonths(p);

  const now = r.experience.find((e) => e.current) ?? r.experience[0];
  const name = p.full_name || (own ? t("auth.accountTitle") : t("social.member"));
  const links = p.links.filter((l) => l.url);

  const avatar = (
    <Avatar url={account.avatarUrl} name={name} size={152} priority fallbackClass="bg-ink-hover text-paper" className="ring-4 ring-signal ring-offset-4 ring-offset-ink" />
  );

  return (
    <>
      <section aria-labelledby="profile-name" className="relative overflow-hidden rounded-3xl bg-ink text-paper">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(rgba(255,255,255,0.07)_1px,transparent_1px)] [background-size:18px_18px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]"
        />
        <div aria-hidden="true" className="pointer-events-none absolute -end-24 -top-24 size-80 rounded-full bg-signal/20 blur-3xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-32 -start-20 size-72 rounded-full bg-[#3b6ea5]/25 blur-3xl" />

        <div className="relative flex flex-col gap-6 p-6 sm:p-10 md:flex-row md:items-center md:gap-8 md:pe-48">
          <div className="rise self-start md:self-center">
            {own ? (
              <Link href="/account/profile" className="group relative block rounded-full" aria-label={account.avatarUrl ? t("profile.photoChange") : t("profile.addPhoto")}>
                {avatar}
                <span className="absolute bottom-1 end-1 grid size-10 place-items-center rounded-full bg-paper text-ink shadow-md transition-transform duration-200 group-hover:scale-110">
                  <Camera aria-hidden="true" className="size-5" />
                </span>
              </Link>
            ) : (
              avatar
            )}
          </div>
          <div className="rise min-w-0 flex-1" style={{ "--delay": "80ms" } as React.CSSProperties}>
            <h1 id="profile-name" className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] break-words sm:text-6xl">
              {name}
            </h1>
            {p.headline && <p className="mt-3 text-lg text-[#dfe5ec] sm:text-xl">{p.headline}</p>}
            {(p.location || p.status === "student") && (
              <p className="mt-2 flex flex-wrap items-center gap-x-2 text-[#c9d2de]">
                {p.location && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin aria-hidden="true" className="size-4" />
                    {p.location}
                  </span>
                )}
                {p.location && p.status === "student" && <span aria-hidden="true">·</span>}
                {p.status === "student" && <span>{t("profile.student")}</span>}
              </p>
            )}
            {links.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {links.map((l) => (
                  <li key={l.url}>
                    <a href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1 underline decoration-white/30 underline-offset-4 hover:decoration-signal">
                      {l.label || l.url}
                      <ArrowUpRight aria-hidden="true" className="size-3.5" />
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2">
              <Count n={social.posts} label={t("social.posts")} />
              <Count n={social.followers} label={t("social.followers")} />
              <Count n={social.following} label={t("social.followingCount")} />
            </dl>
          </div>
          <div className="self-start md:absolute md:end-6 md:top-6">
            {own ? (
              <Link href="/account/profile" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-5 font-medium text-ink transition-colors duration-200 hover:bg-ink-soft">
                <Pencil aria-hidden="true" className="size-4" />
                {hasResume ? t("profile.edit") : t("profile.build")}
              </Link>
            ) : (
              <FollowButton profileId={account.id} initialFollowing={social.isFollowing} />
            )}
          </div>
        </div>

        {(years > 0 || now) && (
          <dl className="relative grid border-t border-white/15 bg-black/10 md:grid-cols-3">
            {years > 0 && (
              <Stat label={t("profile.totalExperience")}>
                <span className="font-display text-3xl font-semibold tabular-nums text-signal sm:text-4xl">{formatMonths(years)}</span>
              </Stat>
            )}
            {now && (
              <Stat label={now.current ? t("profile.currentRole") : t("profile.experience")}>
                <span className="block font-display text-xl font-semibold">{now.title}</span>
                {now.company && <span className="block text-[#c9d2de]">{now.company}</span>}
              </Stat>
            )}
            {fromRoles[0] ? (
              <Stat label={t("profile.topSkill")}>
                <span className="block font-display text-xl font-semibold">{fromRoles[0].skill}</span>
                <span className="block tabular-nums text-[#c9d2de]">{formatMonths(fromRoles[0].months)}</span>
              </Stat>
            ) : (
              r.experience.length > 0 && (
                <Stat label={t("profile.roles")}>
                  <span className="font-display text-3xl font-semibold tabular-nums">{r.experience.length}</span>
                </Stat>
              )
            )}
          </dl>
        )}
      </section>

      {own && !hasResume && account.accountType === "seeker" && (
        <Link href="/account/profile" className="mt-8 flex items-start gap-4 rounded-2xl border border-dashed border-muted/60 bg-surface p-6 hover:border-ink">
          <FileUp aria-hidden="true" className="mt-1 size-6 shrink-0" />
          <span>
            <span className="block font-display text-xl font-semibold">{t("profile.emptyTitle")}</span>
            <span className="mt-1 block text-muted">{t("profile.emptyBody")}</span>
          </span>
        </Link>
      )}

      {bars.length > 0 && (
        <section aria-labelledby="expertise-h" className="mt-10">
          <h2 id="expertise-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("profile.expertise")}
          </h2>
          <p className="text-sm text-muted">{t("profile.expertiseHint")}</p>
          <ul className="mt-5 flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:p-6">
            {bars.map((e, i) => (
              <li key={e.skill} className="grid grid-cols-[minmax(0,7rem)_1fr_auto] items-center gap-3 sm:grid-cols-[10rem_1fr_6.5rem]">
                <span className="truncate font-medium" title={e.skill}>
                  {e.skill}
                </span>
                <span className="h-3 overflow-hidden rounded-full bg-ink-soft">
                  <span
                    className="grow-x block h-full rounded-full bg-gradient-to-r from-ink to-[#3b6ea5]"
                    style={{ width: `${Math.max(6, (e.months / bars[0].months) * 100)}%`, "--delay": `${150 + i * 70}ms` } as React.CSSProperties}
                  />
                </span>
                <span className="text-end text-sm tabular-nums text-muted">{formatMonths(e.months)}</span>
              </li>
            ))}
          </ul>
          {projectSkills.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted">{t("profile.alsoFromProjects")}</span>
              {projectSkills.map((e) => (
                <span key={e.skill} className="rounded-full border border-line bg-surface px-3 py-1">
                  {e.skill}
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      <Career profile={p} />

      <section aria-labelledby="posts-h" className="mt-10 scroll-mt-24">
        <div className="flex items-end justify-between gap-4">
          <h2 id="posts-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            {t("social.posts")}
          </h2>
          <Link href="/feed" className="text-[0.95rem] font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
            {t("posts.openFeed")}
          </Link>
        </div>
        <div className="mt-4 flex flex-col gap-4">
          {own && <PostComposer enabled={canPost} />}
          <PostList posts={posts} viewerId={viewerId} empty={own ? t("posts.emptyOwn") : t("posts.emptyOther")} />
        </div>
      </section>

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

      {own && (
        <>
          <AccountFacts account={account} />
          <form action={signOut} className="mt-8">
            <button type="submit" className="min-h-12 cursor-pointer rounded-full border border-ink px-6 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
              {t("auth.signOut")}
            </button>
          </form>
        </>
      )}
    </>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-sm text-[#c9d2de]">{label}</dt>
      <dd className="font-display text-2xl font-semibold tabular-nums">{compact.format(n)}</dd>
    </div>
  );
}

/** Roles drawn on a shared time axis, so gaps, overlaps and the current role read at a glance. */
function Career({ profile }: { profile: ProfileData }) {
  const nowDate = new Date();
  const nowMonth = nowDate.getUTCFullYear() * 12 + nowDate.getUTCMonth();
  const roles = profile.resume.experience
    .map((e) => {
      const start = toMonth(e.start);
      const end = e.current || !e.end ? nowMonth : toMonth(e.end);
      return start == null || end == null || end < start ? null : { ...e, s: start, e: end };
    })
    .filter((x) => x !== null)
    .sort((a, b) => a.s - b.s);
  if (roles.length === 0) return null;

  const first = Math.floor(roles[0].s / 12) * 12;
  const last = Math.max(nowMonth, ...roles.map((x) => x.e)) + 1;
  const span = last - first;
  const pct = (m: number) => ((m - first) / span) * 100;
  const yearsSpan = Math.ceil(span / 12);
  const step = yearsSpan > 12 ? 4 : yearsSpan > 6 ? 2 : 1;
  const ticks: number[] = [];
  for (let y = first / 12; y * 12 <= last; y += step) ticks.push(y);

  return (
    <section aria-labelledby="career-h" className="mt-10">
      <h2 id="career-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
        {t("profile.career")}
      </h2>
      <div className="mt-5 rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <ol className="flex flex-col gap-4">
          {roles.map((x, i) => (
            <li key={i}>
              <p className="flex flex-wrap items-baseline justify-between gap-x-3 text-[0.95rem]">
                <span className="min-w-0">
                  <strong>{x.title}</strong>
                  {x.company && <span className="text-muted"> · {x.company}</span>}
                </span>
                <span className="text-sm tabular-nums text-muted">{formatMonths(x.e - x.s + 1)}</span>
              </p>
              <div className="relative mt-1.5 h-2.5 rounded-full bg-ink-soft">
                <span
                  className={`grow-x absolute inset-y-0 rounded-full ${x.current ? "bg-signal" : "bg-ink"}`}
                  style={{ insetInlineStart: `${pct(x.s)}%`, width: `${Math.max(1.5, pct(x.e + 1) - pct(x.s))}%`, "--delay": `${100 + i * 90}ms` } as React.CSSProperties}
                />
              </div>
            </li>
          ))}
        </ol>
        <div aria-hidden="true" className="relative mt-3 h-5 border-t border-line text-xs tabular-nums text-muted">
          {ticks.map((y) => (
            <span key={y} className="absolute top-1 -translate-x-1/2 rtl:translate-x-1/2" style={{ insetInlineStart: `${pct(y * 12)}%` }}>
              {y}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-white/15 px-6 py-5 not-last:border-b sm:px-10 md:not-last:border-e md:not-last:border-b-0">
      <dt className="text-xs font-semibold tracking-[0.12em] text-[#c9d2de] uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
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
