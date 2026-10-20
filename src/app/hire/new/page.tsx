import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { t } from "@/i18n";
import { jobReviewEnabled } from "@/lib/job-review";
import { requireMember } from "@/lib/require-member";
import { CompanyGate } from "../company-gate";
import { PostJobForm } from "./post-job-form";

export const metadata: Metadata = { title: "Post a job", robots: { index: false } };

export default function NewJobPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Suspense fallback={<div className="h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

async function Gate() {
  const viewer = await requireMember("/hire/new");
  if (viewer.accountType !== "company") return <CompanyGate kind="not-company" />;
  if (!viewer.companyDomainMatches) return <CompanyGate kind="unverified" site={viewer.website} />;
  return (
    <>
      <Link href="/hire" className="inline-flex min-h-10 items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden="true" className="size-4 rtl:-scale-x-100" />
        {t("hire.dashboardTitle")}
      </Link>
      <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.025em] sm:text-4xl">{t("hire.postTitle")}</h1>
      <p className="mt-2 max-w-[60ch] text-muted">{t("hire.postLead")}</p>
      <PostJobForm enabled={jobReviewEnabled} company={viewer.companyName} />
    </>
  );
}
