// The sections of a member's portfolio-style profile: what they do, proficiency, experience cards, projects,
// certifications, education and a contact band. Server components; motion comes from CSS and <Reveal>.
import { ArrowUpRight, Award, BadgeCheck, CalendarDays, Globe, GraduationCap, MapPin, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { siBehance, siDribbble, siGithub, siGitlab, siInstagram, siKaggle, siLeetcode, siMedium, siStackoverflow, siX, siYoutube } from "simple-icons";
import { companyDomains } from "@/data/db";
import { t } from "@/i18n";
import { formatMonths, type Expertise } from "@/lib/expertise";
import type { ProfileData } from "@/lib/profile-schema";
import { skillIcon } from "@/lib/skill-icons";
import { levelName, skillName } from "@/lib/skill-tests";
import { CompanyLogo } from "./company-logo";
import { Reveal } from "./reveal";
import { SkillGlyph } from "./skill-chip";

type Resume = ProfileData["resume"];
export type Badge = { skill: string; level: string; score: number; awarded_at: string };

const fmtMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1)) : ym;
};

/** Numbers that carry the story in a bullet: 99.6%, $42K/month, 180+, 2K, 3x. */
const METRIC = /(\$\d[\d,.]*[KMB]?(?:\/[a-z]+)?|\d[\d,.]*\s?%|\d[\d,.]*[KMB]?\+|\d[\d,.]*[KMB](?![a-z])|\d[\d,.]*x(?![a-z]))/g;
export function Highlighted({ text }: { text: string }) {
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
    .filter((w) => /^[\p{L}\p{N}]/u.test(w))
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase() || "•";

const hash = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/** Card banners in Rolearch's palette: ink, deep blue, and amber for the role someone holds now. */
const BANNERS = [
  "bg-[linear-gradient(135deg,#0e1f2f,#1d3247)]",
  "bg-[linear-gradient(135deg,#1d3247,#3b6ea5)]",
  "bg-[linear-gradient(135deg,#0e1f2f,#3b6ea5)]",
  "bg-[linear-gradient(135deg,#243b53,#0e1f2f)]",
];
const CURRENT_BANNER = "bg-[linear-gradient(135deg,#8f5b12,#e0a35b)]";

/** Section heading in the portfolio style: a large title with a quiet uppercase line under it. */
export function SectionHead({ id, title, sub, emoji }: { id: string; title: string; sub?: string; emoji?: string }) {
  return (
    <div>
      <h2 id={id} className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
        {title}
        {emoji && (
          <span aria-hidden="true" className="ms-3 inline-block align-middle text-[0.8em]">
            {emoji}
          </span>
        )}
      </h2>
      {sub && <p className="mt-2 text-xs font-semibold tracking-[0.14em] text-muted uppercase sm:text-sm">{sub}</p>}
    </div>
  );
}

// ---------- social links ----------

type Brand = { path: string; hex: string };
const BRANDS: [RegExp, Brand | "in"][] = [
  [/github\.com|^github$/i, siGithub],
  [/gitlab\.com|^gitlab$/i, siGitlab],
  [/linkedin\.com|^linkedin$/i, "in"],
  [/(?:^|\.)x\.com|twitter\.com|^x$|^twitter$/i, siX],
  [/dribbble\.com|^dribbble$/i, siDribbble],
  [/behance\.net|^behance$/i, siBehance],
  [/medium\.com|^medium$/i, siMedium],
  [/youtube\.com|youtu\.be|^youtube$/i, siYoutube],
  [/instagram\.com|^instagram$/i, siInstagram],
  [/kaggle\.com|^kaggle$/i, siKaggle],
  [/stackoverflow\.com|^stack ?overflow$/i, siStackoverflow],
  [/leetcode\.com|^leetcode$/i, siLeetcode],
];

function brandOf(label: string, url: string): Brand | "in" | null {
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {}
  for (const [re, b] of BRANDS) if (re.test(host) || re.test(label.trim())) return b;
  return null;
}

/** Round icon buttons for a member's links, in each brand's colour (LinkedIn's mark isn't in Simple Icons, so it's drawn as text). */
export function SocialLinks({ links, dark = false }: { links: { label: string; url: string }[]; dark?: boolean }) {
  if (!links.length) return null;
  return (
    <ul className="flex flex-wrap gap-2.5">
      {links.map((l) => {
        const b = brandOf(l.label, l.url);
        const name = l.label || l.url;
        return (
          <li key={l.url}>
            <a
              href={l.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={name}
              title={name}
              className={`grid size-11 place-items-center rounded-full shadow-sm transition-transform duration-200 hover:-translate-y-1 ${dark ? "ring-1 ring-white/25" : ""} ${
                b === null ? (dark ? "bg-paper text-ink" : "bg-ink text-paper") : "text-white"
              }`}
              style={b === null ? undefined : { background: b === "in" ? "#0a66c2" : `#${b.hex === "000000" || b.hex === "181717" ? "0e1f2f" : b.hex}` }}
            >
              {b === "in" ? (
                <span aria-hidden="true" className="font-sans text-[15px] font-bold leading-none">
                  in
                </span>
              ) : b ? (
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
                  <path d={b.path} />
                </svg>
              ) : (
                <Globe aria-hidden="true" className="size-5" />
              )}
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- what I do ----------

export function WhatIDo({ resume, headline }: { resume: Resume; headline: string }) {
  const skills = resume.skills.length ? resume.skills : [...new Set(resume.experience.flatMap((e) => e.skills))];
  const now = resume.experience.find((e) => e.current) ?? resume.experience[0];
  const lines = (now?.bullets ?? []).slice(0, 3);
  if (skills.length === 0 && lines.length === 0) return null;
  return (
    <section aria-labelledby="what-h" id="what" className="mt-24 scroll-mt-24 sm:mt-32">
      <div className="grid items-center gap-10 md:grid-cols-2 md:gap-14">
        <Reveal className="order-2 md:order-1">
          <OrbitArt skills={skills.slice(0, 12)} total={skills.length} />
        </Reveal>
        <Reveal className="order-1 md:order-2" delay={120}>
          <SectionHead id="what-h" title={t("profile.whatIDo")} sub={headline || t("profile.whatIDoSub")} />
          {skills.length > 0 && (
            <ul className="mt-7 grid grid-cols-4 gap-x-3 gap-y-5 sm:grid-cols-6">
              {skills.slice(0, 18).map((s) => (
                <li key={s} className="group flex flex-col items-center gap-1.5 text-center">
                  <span className="grid size-12 place-items-center rounded-2xl border border-line bg-surface shadow-sm transition-transform duration-200 group-hover:-translate-y-1 group-hover:border-ink">
                    <SkillGlyph skill={s} size={24} />
                    <Fallback skill={s} />
                  </span>
                  <span className="line-clamp-2 text-[0.7rem] leading-tight text-muted">{s}</span>
                </li>
              ))}
            </ul>
          )}
          {lines.length > 0 && (
            <ul className="mt-8 flex flex-col gap-3">
              {lines.map((b, i) => (
                <li key={i} className="flex gap-3 leading-relaxed">
                  <Zap aria-hidden="true" className="mt-1 size-4 shrink-0 fill-signal text-signal" />
                  <span className="min-w-0">
                    <Highlighted text={b} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Reveal>
      </div>
    </section>
  );
}

/** A tile for a skill with no icon: its initials, so the grid stays even. */
function Fallback({ skill }: { skill: string }) {
  if (skillIcon(skill)) return null;
  return <span className="font-display text-sm font-semibold text-ink">{initialsOf(skill)}</span>;
}

/** Skills placed around two rings that turn slowly in opposite directions, the count in the middle. */
function OrbitArt({ skills, total }: { skills: string[]; total: number }) {
  const inner = skills.slice(0, 5);
  const outer = skills.slice(5, 12);
  const place = (items: string[], r: number) =>
    items.map((s, i) => {
      const a = (2 * Math.PI * i) / items.length - Math.PI / 2;
      return { s, x: 50 + r * Math.cos(a), y: 50 + r * Math.sin(a) };
    });
  const ring = (items: { s: string; x: number; y: number }[], secs: number, reverse: boolean) => (
    <div className={`absolute inset-0 ${reverse ? "orbit-rev" : "orbit"}`} style={{ "--orbit": `${secs}s` } as React.CSSProperties}>
      {items.map(({ s, x, y }) => (
        <div key={s} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
          <div className={reverse ? "orbit" : "orbit-rev"} style={{ "--orbit": `${secs}s` } as React.CSSProperties}>
            <span className="grid size-11 place-items-center rounded-2xl bg-white shadow-[0_10px_24px_-10px_rgba(0,0,0,0.6)] sm:size-12" title={s}>
              <SkillGlyph skill={s} size={22} />
              <Fallback skill={s} />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
  return (
    <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-[28rem] overflow-hidden rounded-[2.5rem] bg-ink">
      <div className="absolute -end-20 -top-24 size-72 rounded-full bg-signal/25 blur-3xl" />
      <div className="absolute -bottom-24 -start-16 size-72 rounded-full bg-[#3b6ea5]/30 blur-3xl" />
      <div className="absolute inset-[24%] rounded-full border border-dashed border-white/20" />
      <div className="absolute inset-[8%] rounded-full border border-dashed border-white/10" />
      {ring(place(inner, 26), 70, false)}
      {ring(place(outer, 42), 110, true)}
      <div className="absolute inset-0 grid place-items-center">
        <div className="text-center">
          <span className="block font-display text-5xl font-semibold tracking-[-0.03em] text-signal tabular-nums">{total}</span>
          <span className="text-xs font-semibold tracking-[0.14em] text-[#c9d2de] uppercase">{t("profile.skills")}</span>
        </div>
      </div>
    </div>
  );
}

// ---------- proficiency + verified badges ----------

export function Proficiency({ expertise, badges, own }: { expertise: Expertise[]; badges: Badge[]; own: boolean }) {
  const bars = expertise.filter((e) => e.source === "experience").slice(0, 6);
  if (bars.length === 0 && badges.length === 0 && !own) return null;
  const max = Math.max(1, ...bars.map((b) => b.months));
  return (
    <section aria-labelledby="prof-h" id="skills" className="mt-24 scroll-mt-24 sm:mt-32">
      <Reveal>
        <SectionHead id="prof-h" title={t("profile.proficiency")} sub={t("profile.proficiencySub")} />
      </Reveal>
      <div className={`mt-10 grid gap-10 ${bars.length ? "md:grid-cols-2 md:gap-14" : ""}`}>
        {bars.length > 0 && (
          <Reveal>
            <ul className="flex flex-col gap-6">
              {bars.map((b, i) => (
                <li key={b.skill}>
                  <p className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 font-medium">
                      <SkillGlyph skill={b.skill} size={18} />
                      {b.skill}
                    </span>
                    <span className="text-sm tabular-nums text-muted">{formatMonths(b.months)}</span>
                  </p>
                  <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-ink-soft">
                    <span
                      className="grow-x block h-full rounded-full bg-[linear-gradient(90deg,#0e1f2f,#3b6ea5_70%,#e0a35b)]"
                      style={{ width: `${Math.max(14, (b.months / max) * 100)}%`, "--delay": `${120 + i * 110}ms` } as React.CSSProperties}
                    />
                  </div>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-sm text-muted">{t("profile.expertiseHint")}</p>
          </Reveal>
        )}
        <Reveal delay={120}>
          <div className="relative overflow-hidden rounded-3xl bg-ink p-6 text-paper sm:p-8">
            <div aria-hidden="true" className="absolute -end-16 -top-16 size-56 rounded-full bg-signal/25 blur-3xl" />
            <p className="relative flex items-center gap-2 text-xs font-semibold tracking-[0.14em] text-signal uppercase">
              <BadgeCheck aria-hidden="true" className="size-4" />
              {t("profile.verifiedTitle")}
            </p>
            {badges.length > 0 ? (
              <ul className="relative mt-5 grid gap-3 sm:grid-cols-2">
                {badges.map((b, i) => (
                  <li key={`${b.skill}-${b.level}`} className="float-y rounded-2xl border border-white/15 bg-white/[0.06] p-4 backdrop-blur" style={{ "--delay": `${i * 700}ms` } as React.CSSProperties}>
                    <span className="flex items-center gap-3">
                      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-signal text-ink shadow-[0_0_0_4px_rgba(224,163,91,0.25)]">
                        <BadgeCheck aria-hidden="true" className="size-6" />
                      </span>
                      <span className="min-w-0">
                        <span className="block font-display font-semibold leading-snug">{skillName(b.skill)}</span>
                        <span className="block text-sm text-[#c9d2de]">
                          {levelName(b.level)} · <span className="tabular-nums">{Math.round(Number(b.score))}%</span>
                        </span>
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="relative mt-4 max-w-[40ch] text-[#dfe5ec]">{own ? t("profile.verifiedEmptyOwn") : t("profile.verifiedEmpty")}</p>
            )}
            <p className="relative mt-5 text-sm text-[#c9d2de]">{t("profile.verifiedHint")}</p>
            {own && (
              <Link href="/skills" className="relative mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-signal px-5 font-medium text-ink transition-colors duration-200 hover:bg-[#ebb877]">
                {t("profile.takeTest")}
                <ArrowUpRight aria-hidden="true" className="size-4" />
              </Link>
            )}
          </div>
        </Reveal>
      </div>
    </section>
  );
}

// ---------- education ----------

export function Education({ items }: { items: Resume["education"] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="edu-h" id="education" className="mt-24 scroll-mt-24 sm:mt-32">
      <Reveal>
        <SectionHead id="edu-h" title={t("profile.education")} sub={t("profile.educationSub")} emoji="🎓" />
      </Reveal>
      <ul className="mt-10 grid gap-5 md:grid-cols-2">
        {items.map((e, i) => (
          <Reveal as="li" key={i} delay={(i % 2) * 90} className="flex gap-5 rounded-3xl border border-line bg-surface p-5 shadow-[0_1px_2px_rgba(14,31,47,0.04),0_12px_32px_-18px_rgba(14,31,47,0.25)] sm:p-6">
            <span aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-full bg-ink font-display text-lg font-semibold text-signal ring-4 ring-signal/30 ring-offset-2 ring-offset-surface">
              {initialsOf(e.school || e.degree) || <GraduationCap className="size-6" />}
            </span>
            <div className="min-w-0">
              <h3 className="font-display text-xl font-semibold leading-snug">{e.school || e.degree}</h3>
              {(e.degree || e.field) && <p className="mt-0.5 font-medium">{[e.degree, e.field].filter(Boolean).join(" in ")}</p>}
              {(e.start || e.end) && (
                <p className="mt-1 inline-flex items-center gap-1.5 text-sm tabular-nums text-muted">
                  <CalendarDays aria-hidden="true" className="size-4" />
                  {[e.start, e.end].filter(Boolean).join(" – ")}
                </p>
              )}
            </div>
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

// ---------- experiences ----------

export async function Experiences({ items }: { items: Resume["experience"] }) {
  if (!items.length) return null;
  const known = await companyDomains(items.map((e) => e.company));
  const domainOf = (e: Resume["experience"][number]) =>
    (e.website ?? "").toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split(/[/?#]/)[0] || known[e.company.trim().toLowerCase()] || null;
  return (
    <section aria-labelledby="exp-h" id="experience" className="mt-24 scroll-mt-24 sm:mt-32">
      <Reveal>
        <SectionHead id="exp-h" title={t("profile.experiences")} sub={t("profile.experiencesSub", { n: items.length })} />
      </Reveal>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((e, i) => {
          const domain = domainOf(e);
          const name = e.company || e.title;
          return (
            <Reveal
              as="li"
              key={i}
              delay={(i % 3) * 110}
              className="group flex flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-[0_1px_2px_rgba(14,31,47,0.04),0_16px_40px_-22px_rgba(14,31,47,0.35)] transition-transform duration-300 hover:-translate-y-1.5"
            >
              <div className={`relative h-28 ${e.current ? CURRENT_BANNER : BANNERS[hash(name) % BANNERS.length]}`}>
                <div aria-hidden="true" className="absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.35)_1px,transparent_1px)] [background-size:14px_14px]" />
                <p className="relative px-5 pt-4 text-center font-display text-lg font-semibold text-white">{e.company || " "}</p>
                {e.current && (
                  <span className="absolute end-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-ink/80 px-2.5 py-1 text-xs font-medium text-paper">
                    <span aria-hidden="true" className="relative flex size-2">
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-signal opacity-70" />
                      <span className="relative inline-flex size-2 rounded-full bg-signal" />
                    </span>
                    {t("profile.currentRole")}
                  </span>
                )}
              </div>
              <div className="-mt-9 flex justify-center">
                <span className="rounded-full bg-surface p-1.5 shadow-md transition-transform duration-300 group-hover:scale-105">
                  {domain ? (
                    <CompanyLogo domain={domain} name={name} size={64} className="rounded-full" />
                  ) : (
                    <span aria-hidden="true" className="grid size-16 place-items-center rounded-full bg-ink font-display text-xl font-semibold text-paper">
                      {initialsOf(name)}
                    </span>
                  )}
                </span>
              </div>
              <div className="flex flex-1 flex-col px-5 pt-3 pb-6 text-center">
                <h3 className="font-display text-lg font-semibold leading-snug">{e.title}</h3>
                <p className="mt-1 text-sm tabular-nums text-muted">{[fmtMonth(e.start), e.current ? t("profile.present") : fmtMonth(e.end)].filter(Boolean).join(" – ")}</p>
                {e.location && (
                  <p className="mt-0.5 inline-flex items-center justify-center gap-1 text-sm text-muted">
                    <MapPin aria-hidden="true" className="size-3.5" />
                    {e.location}
                  </p>
                )}
                {e.bullets.length > 0 && (
                  <ul className="mt-4 flex flex-col gap-2 text-start text-[0.92rem] leading-relaxed">
                    {e.bullets.slice(0, 4).map((b, j) => (
                      <li key={j} className="flex gap-2.5">
                        <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-signal" />
                        <span className="min-w-0">
                          <Highlighted text={b} />
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {e.skills.length > 0 && (
                  <ul className="mt-auto flex flex-wrap justify-center gap-1.5 pt-4">
                    {e.skills.slice(0, 6).map((s) => (
                      <li key={s} className="inline-flex items-center gap-1 rounded-full bg-ink-soft px-2.5 py-0.5 text-xs font-medium">
                        <SkillGlyph skill={s} size={12} />
                        {s}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Reveal>
          );
        })}
      </ul>
    </section>
  );
}

// ---------- projects ----------

export function Projects({ items }: { items: Resume["projects"] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="proj-h" id="projects" className="mt-24 scroll-mt-24 sm:mt-32">
      <Reveal>
        <SectionHead id="proj-h" title={t("profile.bigProjects")} sub={t("profile.projectsSub")} />
      </Reveal>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2">
        {items.map((p, i) => (
          <Reveal
            as="li"
            key={i}
            delay={(i % 2) * 110}
            className="group flex flex-col rounded-3xl border border-line bg-surface p-6 text-center shadow-[0_1px_2px_rgba(14,31,47,0.04),0_16px_40px_-24px_rgba(14,31,47,0.35)] transition-transform duration-300 hover:-translate-y-1.5 sm:p-8"
          >
            <span aria-hidden="true" className="mx-auto grid size-20 place-items-center rounded-3xl bg-[linear-gradient(135deg,#e6e9ee,#f4f5f1)] transition-transform duration-300 group-hover:rotate-3">
              {p.skills[0] ? <BigGlyph skill={p.skills[0]} name={p.name} /> : <span className="font-display text-2xl font-semibold">{initialsOf(p.name)}</span>}
            </span>
            <h3 className="mt-5 font-display text-xl font-semibold leading-snug">{p.name}</h3>
            {p.summary && (
              <p className="mx-auto mt-2 max-w-[48ch] text-[0.95rem] leading-relaxed text-ink/85">
                <Highlighted text={p.summary} />
              </p>
            )}
            {p.skills.length > 0 && (
              <ul className="mt-4 flex flex-wrap justify-center gap-1.5">
                {p.skills.slice(0, 8).map((s) => (
                  <li key={s} className="inline-flex items-center gap-1 rounded-full border border-line px-2.5 py-0.5 text-xs font-medium text-ink/80">
                    <SkillGlyph skill={s} size={12} />
                    {s}
                  </li>
                ))}
              </ul>
            )}
            {p.url && (
              <a
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mx-auto mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
              >
                {t("profile.visitProject")}
                <ArrowUpRight aria-hidden="true" className="size-4 transition-transform duration-200 group-hover:rotate-45" />
              </a>
            )}
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

function BigGlyph({ skill, name }: { skill: string; name: string }) {
  return skillIcon(skill) ? <SkillGlyph skill={skill} size={40} /> : <span className="font-display text-2xl font-semibold">{initialsOf(name)}</span>;
}

// ---------- certifications ----------

export function Achievements({ items }: { items: Resume["certifications"] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="cert-h" id="certifications" className="mt-24 scroll-mt-24 sm:mt-32">
      <Reveal>
        <SectionHead id="cert-h" title={t("profile.achievements")} sub={t("profile.achievementsSub")} emoji="🏆" />
      </Reveal>
      <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((c, i) => (
          <Reveal
            as="li"
            key={i}
            delay={(i % 3) * 110}
            className="group relative flex flex-col overflow-hidden rounded-3xl border border-line bg-surface p-6 text-center shadow-[0_1px_2px_rgba(14,31,47,0.04),0_16px_40px_-24px_rgba(14,31,47,0.35)] transition-transform duration-300 hover:-translate-y-1.5"
          >
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-1 origin-left scale-x-0 bg-signal transition-transform duration-500 group-hover:scale-x-100" />
            <span aria-hidden="true" className="mx-auto grid size-16 place-items-center rounded-full bg-signal/20 text-signal-ink">
              <Award className="size-8" />
            </span>
            <h3 className="mt-4 font-display text-lg font-semibold leading-snug">{c.name}</h3>
            <p className="mt-1 text-sm text-muted">{[c.issuer, fmtMonth(c.issued)].filter(Boolean).join(" · ")}</p>
            {c.expires && <p className="text-xs text-muted">{t("profile.expiresOn", { date: fmtMonth(c.expires) })}</p>}
            {c.url && (
              <div className="mt-auto pt-5">
                <a
                  href={c.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-ink px-4 text-xs font-semibold text-paper transition-colors duration-200 hover:bg-ink-hover"
                >
                  {t("profile.verifyCert")}
                  <ArrowUpRight aria-hidden="true" className="size-3.5" />
                </a>
              </div>
            )}
          </Reveal>
        ))}
      </ul>
    </section>
  );
}

// ---------- contact ----------

export function Contact({
  name,
  links,
  own,
  action,
}: {
  name: string;
  links: { label: string; url: string }[];
  own: boolean;
  action: React.ReactNode;
}) {
  return (
    <Reveal as="section" id="contact" className="relative mt-24 scroll-mt-24 overflow-hidden rounded-[2.5rem] bg-ink px-6 py-12 text-paper sm:mt-32 sm:px-12 sm:py-16">
      <div aria-hidden="true" className="absolute -end-24 -top-24 size-80 rounded-full bg-signal/25 blur-3xl" />
      <div aria-hidden="true" className="absolute -bottom-28 -start-20 size-80 rounded-full bg-[#3b6ea5]/30 blur-3xl" />
      <div className="relative grid items-center gap-8 md:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">
            {t("profile.contactTitle")}{" "}
            <span aria-hidden="true" className="wave-hand">
              ☎️
            </span>
          </h2>
          <p className="mt-3 max-w-[52ch] text-lg text-[#dfe5ec]">{own ? t("profile.contactLeadOwn") : t("profile.contactLead", { name })}</p>
          <div className="mt-6">
            <SocialLinks links={links} dark />
          </div>
        </div>
        <div className="flex flex-col items-start gap-3 md:items-end">
          {action}
          <span className="inline-flex items-center gap-1.5 text-sm text-[#c9d2de]">
            <Sparkles aria-hidden="true" className="size-4 text-signal" />
            {t("profile.onRolearch")}
          </span>
        </div>
      </div>
    </Reveal>
  );
}
