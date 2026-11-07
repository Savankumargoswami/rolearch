import { BadgeCheck, MapPin, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Avatar } from "@/components/avatar";
import { t } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { CompanyGate } from "../company-gate";

export const metadata: Metadata = { title: "Talent search", robots: { index: false } };

type Row = {
  id: string;
  full_name: string;
  headline: string;
  location: string;
  avatar_url: string;
  target_roles: string[];
  work_mode: string;
  skills: string[];
  badges: number;
  open_since: string | null;
};

export default function TalentPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("talent.eyebrow")}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("talent.title")}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t("talent.lead")}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Talent searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Talent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const q = String((await searchParams).q ?? "").trim().slice(0, 80);
  const viewer = await requireMember(`/hire/talent${q ? `?q=${encodeURIComponent(q)}` : ""}`);
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  if (!viewer.companyDomainMatches) return <CompanyGate kind="unverified" site={viewer.website} />;
  const db = await createClient();
  const { data, error } = await db.rpc("talent_search", { p_query: q, p_limit: 60 });
  const rows = (data ?? []) as Row[];

  return (
    <>
      <form action="/hire/talent" className="mt-6 flex flex-col gap-2 rounded-2xl border border-line bg-surface p-3 sm:flex-row sm:items-end">
        <label className="flex flex-1 flex-col gap-1 text-sm">
          <span className="font-medium">{t("talent.searchLabel")}</span>
          <input name="q" defaultValue={q} placeholder={t("talent.searchPh")} maxLength={80} className="h-11 rounded-xl border border-line bg-paper/40 px-3" />
        </label>
        <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          <Search aria-hidden="true" className="size-4" />
          {t("talent.search")}
        </button>
      </form>
      <p className="mt-3 text-sm text-muted">{t("talent.privacy")}</p>
      {error ? (
        <p className="mt-6 text-muted">{t("tracker.errNotReady")}</p>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-muted">{q ? t("talent.none", { q }) : t("talent.empty")}</p>
      ) : (
        <ul className="mt-6 grid gap-3 md:grid-cols-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/u/${r.id}`} className="flex h-full gap-4 rounded-2xl border border-line bg-surface p-4 hover:border-ink">
                <Avatar url={r.avatar_url ?? ""} name={r.full_name || "?"} size={52} />
                <span className="min-w-0">
                  <span className="block font-display text-lg font-semibold">{r.full_name || t("social.member")}</span>
                  {r.headline && <span className="block text-sm">{r.headline}</span>}
                  <span className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-muted">
                    {r.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden="true" className="size-3.5" />
                        {r.location}
                      </span>
                    )}
                    {r.work_mode && r.work_mode !== "any" && <span>{t(`prefs.mode_${r.work_mode}` as "prefs.mode_any")}</span>}
                    {r.badges > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-ink">
                        <BadgeCheck aria-hidden="true" className="size-4 text-signal-ink" />
                        {t("talent.badges", { n: r.badges })}
                      </span>
                    )}
                  </span>
                  {r.target_roles?.length > 0 && <span className="mt-1 block text-sm">{t("talent.targets", { roles: r.target_roles.join(", ") })}</span>}
                  {r.skills?.length > 0 && <span className="mt-1 block truncate text-xs text-muted">{r.skills.slice(0, 10).join(" · ")}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
