import { Building2, LayoutDashboard, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { CompanyLogo } from "./company-logo";

const domainOf = (site: string) => site.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/[/?#].*$/, "").toLowerCase();

/** The top of every company page: "Rolearch for companies", the company, its tabs and Post a job. */
export function CompanyBar({ name, website, verified, current }: { name: string; website: string; verified: boolean; current: "dashboard" | "candidates" | "profile" }) {
  const tabs = [
    { key: "dashboard", href: "/hire", label: "Dashboard", icon: LayoutDashboard },
    { key: "candidates", href: "/hire/candidates", label: "Candidates", icon: UsersRound },
    { key: "profile", href: "/account", label: "Company profile", icon: Building2 },
  ] as const;
  return (
    <div className="rounded-3xl bg-ink p-4 text-paper sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <CompanyLogo domain={domainOf(website) || null} name={name || "Company"} size={44} />
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wide text-signal uppercase">Rolearch for companies</p>
            <p className="truncate font-display text-xl font-semibold">{name || "Your company"}</p>
          </div>
        </div>
        {verified && (
          <Link href="/hire/new" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-signal px-5 font-medium text-ink hover:bg-[#ebb877]">
            <Plus aria-hidden="true" className="size-4" />
            Post a job
          </Link>
        )}
      </div>
      <nav aria-label="Company" className="mt-4 -mb-1 flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={current === tab.key ? "page" : undefined}
            className={`inline-flex min-h-10 items-center gap-1.5 whitespace-nowrap rounded-full px-4 text-sm font-medium transition-colors ${current === tab.key ? "bg-paper text-ink" : "text-[#dfe5ec] hover:bg-white/10"}`}
          >
            <tab.icon aria-hidden="true" className="size-4" />
            {tab.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
