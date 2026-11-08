// Best-suited roles for the signed-in member: the roles their background points to (their target roles, their
// current role, and the moves it commonly leads to), and the open jobs that fit them best right now, each with the
// reason. Shown on the homepage, the dashboard and the member's own profile.
import { ArrowRight, Compass, Sparkles } from "lucide-react";
import Link from "next/link";
import { searchJobs } from "@/data/db";
import type { JobLite } from "@/data/types";
import { t } from "@/i18n";
import { coreTitle } from "@/lib/ats";
import { fitsFor, type ListFit } from "@/lib/fit-list";
import { loadPreferences } from "@/lib/preferences";
import type { AccountProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { transitionNetwork } from "@/lib/transitions";
import { JobRow } from "./job-row";
import { Reveal } from "./reveal";

/** Roles to explore, most relevant first: what they're aiming for, what they do now, and where that commonly leads. */
async function suggestedRoles(viewer: AccountProfile): Promise<{ main: string; roles: string[] }> {
  const p = viewer.profile;
  const current = p.resume.experience.find((e) => e.current) ?? p.resume.experience[0];
  const now = coreTitle(current?.title ?? "") || coreTitle(p.headline);
  const prefs = await loadPreferences(await createClient());
  const main = prefs.targetRoles[0] || now;
  const nearby = now ? transitionNetwork(now, main || now, p.resume.skills).filter((r) => r.kind === "nearby").map((r) => r.steps[r.steps.length - 1]) : [];
  const seen = new Set<string>();
  const roles = [...prefs.targetRoles, now, ...nearby].filter((r) => {
    const k = r.trim().toLowerCase();
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return { main, roles: roles.slice(0, 6) };
}

export async function BestRoles({ viewer, limit = 5, heading = "h2" }: { viewer: AccountProfile; limit?: number; heading?: "h2" | "h3" }) {
  if (viewer.accountType === "company") return null;
  const p = viewer.profile;
  const H = heading;
  if (p.resume.experience.length + p.resume.skills.length === 0) {
    return (
      <section aria-labelledby="best-h" className="mt-8 rounded-3xl border border-dashed border-line p-5 sm:p-6">
        <H id="best-h" className="font-display text-xl font-semibold">
          {t("best.title")}
        </H>
        <p className="mt-1 text-muted">{t("best.needProfile")}</p>
        <Link href="/account/profile" className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("profile.build")}
          <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
      </section>
    );
  }

  const { main, roles } = await suggestedRoles(viewer);
  let ranked: { job: JobLite; fit: ListFit }[] = [];
  if (main) {
    const q = { q: main, cat: "all" as const, where: "anywhere" as const, remote: false, visa: false, pay: false, level: "any" as const, sort: "match" as const };
    const { jobs } = await searchJobs(q, 1, 40).catch(() => ({ jobs: [] as JobLite[] }));
    const fits = await fitsFor(jobs, viewer);
    ranked = jobs
      .map((job) => ({ job, fit: fits.get(job.id) }))
      .filter((x): x is { job: JobLite; fit: ListFit } => Boolean(x.fit) && (x.fit!.verdict === "strong" || x.fit!.verdict === "potential"))
      .sort((a, b) => b.fit.score - a.fit.score)
      .slice(0, limit);
  }

  return (
    <Reveal className="mt-8">
      <section aria-labelledby="best-h" className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
      <p className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-muted uppercase">
        <Sparkles aria-hidden="true" className="size-4 text-signal-ink" />
        {t("fit.eyebrow")}
      </p>
      <H id="best-h" className="mt-1 font-display text-2xl font-semibold tracking-[-0.02em]">
        {t("best.title")}
      </H>
      {roles.length > 0 && (
        <>
          <p className="mt-3 text-sm font-medium">{t("best.rolesTitle")}</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {roles.map((r, i) => (
              <li key={r}>
                <Link
                  href={`/discover?role=${encodeURIComponent(r)}`}
                  className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors ${i === 0 ? "bg-signal/25 hover:bg-signal/40" : "border border-line hover:border-ink"}`}
                >
                  <Compass aria-hidden="true" className="size-3.5" />
                  {r}
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="mt-5 text-sm font-medium">{main ? t("best.jobsTitle", { role: main }) : t("best.jobsTitleAny")}</p>
      {ranked.length ? (
        <ul className="-mx-3 mt-1 divide-y divide-line sm:-mx-4">
          {ranked.map(({ job, fit }, i) => (
            <Reveal as="li" key={job.id} delay={i * 80}>
              <JobRow job={job} fit={fit} />
              <p className="-mt-2 px-3 pb-3 text-sm text-muted sm:px-4">
                {[t("fit.listTitle", { strong: fit.strong, total: fit.total }), fit.transfer ? t("fit.listTransfer", { what: fit.transfer }) : "", fit.missing ? t("fit.listMissing", { what: fit.missing }) : ""]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Reveal>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted">{main ? t("best.none", { role: main }) : t("best.noRole")}</p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={main ? `/discover?role=${encodeURIComponent(main)}` : "/discover"} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("best.queue")}
          <ArrowRight aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        </Link>
        <Link href="/account/profile" className="inline-flex min-h-11 items-center rounded-full border border-line px-5 font-medium hover:border-ink">
          {t("best.prefs")}
        </Link>
      </div>
      </section>
    </Reveal>
  );
}
