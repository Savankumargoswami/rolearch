import type { Metadata } from "next";
import { Suspense } from "react";
import { SkillsReportView } from "@/components/skills-report-view";
import { monthName, reportMonths, skillsReport } from "@/lib/skills-report";

export async function generateMetadata(): Promise<Metadata> {
  const [latest] = await reportMonths();
  if (!latest) return { title: "Rolearch Skills Report", robots: { index: false } };
  return {
    title: `Skills Report ${monthName(latest)}: the skills employers ask for`,
    description: `Measured from open job postings across every industry: the most-asked skills, AI skill demand by industry, and what's rising, in ${monthName(latest)}.`,
    alternates: { canonical: `/reports/skills/${latest}` },
  };
}

/** The latest monthly Skills Report. */
export default function SkillsReportPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-4xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Latest />
    </Suspense>
  );
}

async function Latest() {
  const months = await reportMonths();
  const r = months[0] ? await skillsReport(months[0]) : null;
  if (!r) return <p className="mx-auto max-w-4xl px-4 py-20 text-muted sm:px-6">The first Skills Report is being measured. Check back tomorrow.</p>;
  return <SkillsReportView r={r} months={months} />;
}
