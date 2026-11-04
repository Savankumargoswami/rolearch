import { ArrowUpRight, BadgeCheck, Camera, CircleAlert, CircleCheck, FileUp, Globe, Pencil } from "lucide-react";
import { SkillGlyph } from "@/components/skill-chip";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { Avatar } from "@/components/avatar";
import { FollowButton } from "@/components/follow-button";
import { PostComposer } from "@/components/post-composer";
import { PostList } from "@/components/post-card";
import { ProfileBackdrop } from "@/components/profile-backdrop";
import { Achievements, type Badge, Contact, Education, Experiences, Proficiency, Projects, SectionHead, SocialLinks, WhatIDo } from "@/components/portfolio";
import { Reveal } from "@/components/reveal";
import { t } from "@/i18n";
import { expertiseOf, formatMonths, totalMonths } from "@/lib/expertise";
import { occupationScene } from "@/lib/occupation-scene";
import type { AccountProfile } from "@/lib/profile";
import type { ProfileData } from "@/lib/profile-schema";
import type { Post, Social } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";

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

/** A member's profile as a portfolio: a greeting hero, what they do, proficiency and verified badges, experience,
 *  career, projects, certifications, education, posts and a contact band. */
export async function ProfileView({ account, mode, social, posts, viewerId, canPost = false }: Props) {
  const own = mode === "own";
  const { profile: p } = account;
  const r = p.resume;
  const hasResume = r.experience.length + r.education.length + r.projects.length + r.certifications.length + r.skills.length > 0;
  const expertise = expertiseOf(p);
  const fromRoles = expertise.filter((e) => e.source === "experience");
  const years = totalMonths(p);
  const badges = await badgesOf(account.id);

  const now = r.experience.find((e) => e.current) ?? r.experience[0];
  const name = p.full_name || (own ? t("auth.accountTitle") : t("social.member"));
  const first = p.full_name.trim().split(/\s+/)[0] || name;
  const portfolio = p.links.find((l) => l.url && l.label.trim().toLowerCase() === "portfolio");
  const links = p.links.filter((l) => l.url && l !== portfolio);
  const allLinks = p.links.filter((l) => l.url);
  const skillCount = (r.skills.length ? r.skills : [...new Set(r.experience.flatMap((e) => e.skills))]).length;

  const nav = [
    (skillCount > 0 || (now?.bullets.length ?? 0) > 0) && { href: "#what", label: t("profile.whatIDo") },
    (fromRoles.length > 0 || badges.length > 0 || own) && { href: "#skills", label: t("profile.proficiency") },
    r.experience.length > 0 && { href: "#experience", label: t("profile.experience") },
    r.projects.length > 0 && { href: "#projects", label: t("profile.projects") },
    r.certifications.length > 0 && { href: "#certifications", label: t("profile.certifications") },
    r.education.length > 0 && { href: "#education", label: t("profile.education") },
    { href: "#posts", label: t("social.posts") },
    { href: "#contact", label: t("profile.contactNav") },
  ].filter((x): x is { href: string; label: string } => Boolean(x));

  const avatar = (
    <Avatar url={account.avatarUrl} name={name} size={176} priority fallbackClass="bg-ink-hover text-paper text-5xl" className="ring-4 ring-signal ring-offset-4 ring-offset-ink" />
  );

  return (
    <>
      <section aria-labelledby="profile-name" className="relative grid items-center gap-12 md:grid-cols-[1.15fr_0.85fr] md:gap-10">
        <div className="min-w-0">
          <p className="rise inline-flex max-w-full items-center gap-2 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm shadow-sm">
            <span aria-hidden="true" className="relative flex size-2 shrink-0">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-70" />
              <span className="relative inline-flex size-2 rounded-full bg-signal" />
            </span>
            <span className="truncate">{[p.status === "student" ? t("profile.student") : now?.title, p.location].filter(Boolean).join(" · ") || t("social.member")}</span>
          </p>
          <h1
            id="profile-name"
            className="rise mt-6 font-display text-5xl font-semibold leading-[1.02] tracking-[-0.04em] break-words sm:text-7xl"
            style={{ "--delay": "80ms" } as React.CSSProperties}
          >
            {t("profile.hi")}{" "}
            <span className="relative inline-block">
              {first}
              <svg aria-hidden="true" viewBox="0 0 200 14" preserveAspectRatio="none" className="absolute -bottom-2 start-0 h-3 w-full text-signal">
                <path
                  className="draw"
                  style={{ "--len": 220, "--delay": "500ms" } as React.CSSProperties}
                  d="M2 9 C 50 2, 120 2, 198 8"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="5"
                  strokeLinecap="round"
                />
              </svg>
            </span>{" "}
            <span aria-hidden="true" className="wave-hand">
              👋
            </span>
          </h1>
          {p.full_name && first !== p.full_name.trim() && (
            <p className="rise mt-4 text-lg font-medium text-muted" style={{ "--delay": "140ms" } as React.CSSProperties}>
              {p.full_name}
            </p>
          )}
          {p.headline && (
            <p className="rise mt-4 max-w-[44ch] text-xl leading-relaxed text-ink/80 sm:text-2xl" style={{ "--delay": "180ms" } as React.CSSProperties}>
              {p.headline}
            </p>
          )}
          {links.length > 0 && (
            <div className="rise mt-6" style={{ "--delay": "240ms" } as React.CSSProperties}>
              <SocialLinks links={links} />
            </div>
          )}
          <div className="rise mt-7 flex flex-wrap items-start gap-3" style={{ "--delay": "300ms" } as React.CSSProperties}>
            {own ? (
              <Link href="/account/profile" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover">
                <Pencil aria-hidden="true" className="size-4" />
                {hasResume ? t("profile.edit") : t("profile.build")}
              </Link>
            ) : (
              <FollowButton profileId={account.id} initialFollowing={social.isFollowing} light />
            )}
            {portfolio && (
              <a
                href={portfolio.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-12 items-center gap-2 rounded-full bg-signal px-6 font-medium text-ink transition-colors duration-200 hover:bg-[#e8b977]"
              >
                <Globe aria-hidden="true" className="size-4" />
                {t("profile.viewPortfolio")}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </a>
            )}
            <a href="#contact" className="inline-flex min-h-12 items-center gap-2 rounded-full border border-ink/25 px-6 font-medium transition-colors duration-200 hover:border-ink">
              {t("profile.contactNav")}
            </a>
          </div>
          <dl className="rise mt-8 flex flex-wrap gap-x-8 gap-y-3" style={{ "--delay": "360ms" } as React.CSSProperties}>
            <Count n={social.posts} label={t("social.posts")} />
            <Count n={social.followers} label={t("social.followers")} />
            <Count n={social.following} label={t("social.followingCount")} />
          </dl>
        </div>

        <div className="rise relative mx-auto w-full max-w-[22rem] px-6 sm:px-0" style={{ "--delay": "200ms" } as React.CSSProperties}>
          <div className="relative aspect-[4/5]">
            <div className="absolute inset-0 overflow-hidden rounded-[2.5rem] bg-ink shadow-[0_30px_60px_-30px_rgba(14,31,47,0.6)]">
              <ProfileBackdrop scene={occupationScene(p.headline, now?.title)} framed />
            </div>
            <div className="absolute inset-0 grid place-items-center">
              {own ? (
                <Link href="/account/profile" className="group relative block rounded-full" aria-label={account.avatarUrl ? t("profile.photoChange") : t("profile.addPhoto")}>
                  {avatar}
                  <span className="absolute bottom-2 end-2 grid size-11 place-items-center rounded-full bg-paper text-ink shadow-md transition-transform duration-200 group-hover:scale-110">
                    <Camera aria-hidden="true" className="size-5" />
                  </span>
                </Link>
              ) : (
                avatar
              )}
            </div>
            {years > 0 && (
              <Floating className="-start-6 top-8 sm:-start-12" delay={0}>
                <span className="block font-display text-2xl font-semibold whitespace-nowrap tabular-nums text-ink">{formatMonths(years)}</span>
                <span className="block text-xs font-semibold tracking-[0.1em] text-muted uppercase">{t("profile.totalExperience")}</span>
              </Floating>
            )}
            {fromRoles[0] && (
              <Floating className="-end-6 bottom-24 sm:-end-10" delay={1200}>
                <span className="flex items-center gap-2 font-display font-semibold whitespace-nowrap text-ink">
                  <SkillGlyph skill={fromRoles[0].skill} size={20} />
                  {fromRoles[0].skill}
                </span>
                <span className="block text-xs font-semibold tracking-[0.1em] text-muted uppercase">{t("profile.topSkill")}</span>
              </Floating>
            )}
            {badges.length > 0 && (
              <Floating className="-bottom-5 start-6" delay={2400}>
                <span className="flex items-center gap-2 font-display font-semibold whitespace-nowrap text-ink">
                  <BadgeCheck aria-hidden="true" className="size-5 text-signal-ink" />
                  {t("profile.verifiedCount", { n: badges.length })}
                </span>
              </Floating>
            )}
          </div>
        </div>
      </section>

      {nav.length > 2 && (
        <nav aria-label={t("profile.sectionsNav")} className="rail mt-16 -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
          {nav.map((n) => (
            <a
              key={n.href}
              href={n.href}
              className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-medium transition-colors duration-200 hover:border-ink hover:bg-ink hover:text-paper"
            >
              {n.label}
            </a>
          ))}
        </nav>
      )}

      {own && !hasResume && account.accountType === "seeker" && (
        <Link href="/account/profile" className="mt-10 flex items-start gap-4 rounded-3xl border border-dashed border-muted/60 bg-surface p-6 hover:border-ink">
          <FileUp aria-hidden="true" className="mt-1 size-6 shrink-0" />
          <span>
            <span className="block font-display text-xl font-semibold">{t("profile.emptyTitle")}</span>
            <span className="mt-1 block text-muted">{t("profile.emptyBody")}</span>
          </span>
        </Link>
      )}

      <WhatIDo resume={r} headline={p.headline} />
      <Proficiency expertise={expertise} badges={badges} own={own} />
      <Experiences items={r.experience} />
      <Career profile={p} />
      <Projects items={r.projects} />
      <Achievements items={r.certifications} />
      <Education items={r.education} />

      <section aria-labelledby="posts-h" id="posts" className="mt-24 scroll-mt-24 sm:mt-32">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead id="posts-h" title={t("social.posts")} sub={t("profile.postsSub")} />
          <Link href="/feed" className="text-[0.95rem] font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
            {t("posts.openFeed")}
          </Link>
        </Reveal>
        <div className="mt-8 flex max-w-3xl flex-col gap-4">
          {own && <PostComposer enabled={canPost} />}
          <PostList posts={posts} viewerId={viewerId} empty={own ? t("posts.emptyOwn") : t("posts.emptyOther")} />
        </div>
      </section>

      <Contact
        name={first}
        links={allLinks}
        own={own}
        action={
          own ? (
            <Link href="/account/profile" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-paper px-6 font-medium text-ink transition-colors duration-200 hover:bg-ink-soft">
              <Pencil aria-hidden="true" className="size-4" />
              {allLinks.length ? t("profile.edit") : t("profile.addLinks")}
            </Link>
          ) : (
            <FollowButton profileId={account.id} initialFollowing={social.isFollowing} />
          )
        }
      />

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

function Floating({ className, delay, children }: { className: string; delay: number; children: React.ReactNode }) {
  return (
    <div
      className={`float-y absolute rounded-2xl border border-line bg-surface/95 px-4 py-3 shadow-[0_18px_40px_-18px_rgba(14,31,47,0.45)] backdrop-blur ${className}`}
      style={{ "--delay": `${delay}ms` } as React.CSSProperties}
    >
      {children}
    </div>
  );
}

async function badgesOf(userId: string): Promise<Badge[]> {
  const db = await createClient();
  const { data } = await db.from("skill_badges").select("skill,level,score,awarded_at").eq("user_id", userId).order("awarded_at", { ascending: false });
  return (data ?? []) as Badge[];
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex flex-col-reverse">
      <dt className="text-sm text-muted">{label}</dt>
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
    <section aria-labelledby="career-h" className="mt-24 sm:mt-32">
      <Reveal>
        <SectionHead id="career-h" title={t("profile.career")} sub={t("profile.careerSub")} />
      </Reveal>
      <Reveal className="mt-8 rounded-3xl border border-line bg-surface p-5 sm:p-8">
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
      </Reveal>
    </section>
  );
}

function AccountFacts({ account }: { account: AccountProfile }) {
  const company = account.accountType === "company";
  return (
    <section aria-labelledby="account-h" className="mt-16">
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
