import { BadgeCheck, CircleAlert, ExternalLink, LayoutDashboard, Plus, Rss, UsersRound } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { t } from "@/i18n";
import { count } from "@/lib/format";
import type { AccountProfile } from "@/lib/profile";
import type { Post, Social } from "@/lib/social";
import { CompanyBar } from "./company-bar";
import { CompanyLogo } from "./company-logo";
import { PostList } from "./post-card";
import { PostComposer } from "./post-composer";

const domainOf = (site: string) => site.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[/?#].*$/, "").toLowerCase();

/** A company's own account page: who they are on Rolearch, where to hire from, and their hiring posts. */
export function CompanyAccount({
  account,
  social,
  posts,
  stats,
  canPost,
}: {
  account: AccountProfile;
  social: Social;
  posts: Post[];
  stats: { openJobs: number; applicants: number; waiting: number };
  canPost: boolean;
}) {
  const domain = domainOf(account.website);
  const verified = account.companyDomainMatches;
  const actions = [
    { href: "/hire", icon: LayoutDashboard, title: "Hiring dashboard", body: "Applicants, funnel and reply times for your jobs." },
    { href: "/hire/candidates", icon: UsersRound, title: "Candidates", body: stats.waiting ? `${stats.waiting} waiting 14+ days for a reply.` : "Everyone who applied, ranked by verified match." },
    ...(verified ? [{ href: "/hire/new", icon: Plus, title: "Post a job", body: "Reviewed and live on Rolearch in minutes." }] : []),
    { href: "/hire#feeds", icon: Rss, title: "Connect your job feed", body: "Your hiring system's jobs, kept in sync automatically." },
  ];
  return (
    <>
      <CompanyBar name={account.companyName} website={account.website} verified={verified} current="profile" />

      <section aria-labelledby="company-h" className="mt-6 rounded-3xl border border-line bg-surface p-5 sm:p-7">
        <div className="flex flex-wrap items-start gap-5">
          <CompanyLogo domain={domain || null} name={account.companyName || "Company"} size={88} className="rounded-2xl" />
          <div className="min-w-0 flex-1">
            <h1 id="company-h" className="font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">
              {account.companyName || "Your company"}
            </h1>
            {account.website && (
              <a href={/^https?:\/\//.test(account.website) ? account.website : `https://${account.website}`} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 text-muted hover:text-ink">
                {domain} <ExternalLink aria-hidden="true" className="size-3.5" />
              </a>
            )}
            <p className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${verified ? "bg-[#E8F3F1] text-[#0B5A50]" : "bg-[#FDF3E3] text-[#7A4708]"}`}>
              {verified ? <BadgeCheck aria-hidden="true" className="size-4" /> : <CircleAlert aria-hidden="true" className="size-4" />}
              {verified ? "Verified employer" : "Not verified yet"}
            </p>
            {!verified && <p className="mt-2 max-w-[60ch] text-sm text-muted">{t("auth.accountDomainNo")}</p>}
          </div>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Open jobs", stats.openJobs],
            ["Applicants", stats.applicants],
            ["Followers", social.followers],
            ["Posts", social.posts],
          ].map(([label, n]) => (
            <div key={label} className="rounded-2xl bg-ink-soft p-4">
              <dt className="text-sm text-muted">{label}</dt>
              <dd className="mt-1 font-display text-2xl font-semibold tabular-nums">{count(Number(n))}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-label="Hiring" className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {actions.map((a) => (
          <Link key={a.href} href={a.href} className="group flex flex-col rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-ink">
            <span className="grid size-10 place-items-center rounded-xl bg-ink text-paper">
              <a.icon aria-hidden="true" className="size-5" />
            </span>
            <span className="mt-3 font-semibold group-hover:underline">{a.title}</span>
            <span className="mt-1 text-sm text-muted">{a.body}</span>
          </Link>
        ))}
      </section>

      <section aria-labelledby="posts-h" className="mt-10">
        <h2 id="posts-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
          Hiring posts
        </h2>
        <p className="mt-1 text-muted">Members whose profile matches the role see your post first and can tell you they&apos;re interested.</p>
        <div className="mt-4 flex flex-col gap-4">
          <PostComposer enabled={canPost} company />
          <PostList posts={posts} viewerId={account.id} empty="No hiring posts yet. Post the role, where it's based and how to apply." />
        </div>
      </section>

      <section aria-labelledby="details-h" className="mt-10">
        <h2 id="details-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
          {t("profile.accountDetails")}
        </h2>
        <dl className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface px-6">
          {[
            [t("auth.accountEmail"), account.email],
            [t("auth.accountType"), t("auth.accountCompany")],
            [t("auth.accountCompanyName"), account.companyName],
            [t("auth.accountWebsite"), account.website],
          ].map(([label, value]) => (
            <div key={label} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
              <dt className="text-muted">{label}</dt>
              <dd className="min-w-0 break-words font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <form action={signOut} className="mt-6">
          <button type="submit" className="inline-flex min-h-11 cursor-pointer items-center rounded-full border border-ink px-5 font-medium hover:bg-ink hover:text-paper">
            {t("auth.signOut")}
          </button>
        </form>
      </section>
    </>
  );
}
