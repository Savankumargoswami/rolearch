import { FileText, ScanSearch } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t, type MessageKey } from "@/i18n";
import { requireMember } from "@/lib/require-member";
import { createClient } from "@/lib/supabase/server";
import { VersionActions } from "./version-actions";

export const metadata: Metadata = { title: "Resume versions", robots: { index: false } };

const date = new Intl.DateTimeFormat("en", { dateStyle: "medium" });

export default function ResumesPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <p className="text-xs font-semibold tracking-[0.14em] text-muted uppercase">{t("versions.eyebrow")}</p>
      <h1 className="mt-1 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("versions.title")}</h1>
      <p className="mt-2 max-w-[62ch] text-muted">{t("versions.lead")}</p>
      <Suspense fallback={<div className="mt-8 h-64 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Versions />
      </Suspense>
    </div>
  );
}

async function Versions() {
  const viewer = await requireMember("/account/resumes");
  const db = await createClient();
  const [{ data, error }, { data: tracked }] = await Promise.all([
    db.from("resume_versions").select("id,job_id,title,company,label,accepted,kept,created_at").eq("user_id", viewer.id).order("created_at", { ascending: false }).limit(100),
    db.from("tracked_jobs").select("*").eq("user_id", viewer.id),
  ]);
  if (error) return <p className="mt-8 rounded-2xl border border-dashed border-line p-6 text-muted">{t("tracker.errNotReady")}</p>;
  // The outcome of each version, when it was sent to a tracked job.
  const outcome = new Map<string, string>();
  for (const r of (tracked ?? []) as Record<string, unknown>[]) if (typeof r.resume_version === "string") outcome.set(r.resume_version, String(r.status));

  const original = (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-ink bg-surface p-4">
      <span className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-xl bg-ink text-paper">
          <FileText aria-hidden="true" className="size-5" />
        </span>
        <span>
          <span className="block font-medium">{t("versions.original")}</span>
          <span className="block text-sm text-muted">{t("versions.originalNote")}</span>
        </span>
      </span>
      <Link href="/account/profile" className="inline-flex min-h-10 items-center rounded-full border border-ink px-4 text-sm font-medium hover:bg-ink-soft">
        {t("profile.edit")}
      </Link>
    </li>
  );

  return (
    <ul className="mt-8 flex flex-col gap-3">
      {original}
      {(data ?? []).map((v) => {
        const status = outcome.get(v.id);
        return (
          <li key={v.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{v.label || v.title || t("versions.untitled")}</p>
                <p className="text-sm text-muted">
                  {date.format(new Date(v.created_at))} · {t("versions.counts", { accepted: v.accepted, kept: v.kept })}
                </p>
                {status && (
                  <p className="mt-1 text-sm">
                    <span className="rounded-full bg-signal/20 px-2 py-0.5 text-xs font-medium">{t("versions.outcome")}</span>{" "}
                    {t(`tracker.s_${status}` as MessageKey)}
                  </p>
                )}
                {v.job_id && (
                  <Link href={`/jobs/${v.job_id}`} className="mt-1 inline-flex items-center gap-1 text-sm underline underline-offset-4">
                    <ScanSearch aria-hidden="true" className="size-3.5" />
                    {t("versions.openJob")}
                  </Link>
                )}
              </div>
              <VersionActions id={v.id} />
            </div>
          </li>
        );
      })}
      {!data?.length && <li className="rounded-2xl border border-dashed border-line p-6 text-muted">{t("versions.empty")}</li>}
    </ul>
  );
}
