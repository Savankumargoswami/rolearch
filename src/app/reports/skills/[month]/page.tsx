import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { SkillsReportView } from "@/components/skills-report-view";
import { monthName, reportMonths, skillsReport } from "@/lib/skills-report";

type Props = { params: Promise<{ month: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { month } = await params;
  const months = await reportMonths();
  if (!months.includes(month)) return { robots: { index: false } };
  return {
    title: `Skills Report ${monthName(month)}: the skills employers ask for`,
    description: `Measured from open job postings across every industry: the most-asked skills, AI skill demand by industry, and what's rising, in ${monthName(month)}.`,
    alternates: { canonical: `/reports/skills/${month}` },
  };
}

/** One month's Skills Report. */
export default function SkillsReportMonthPage({ params }: Props) {
  return (
    <Suspense fallback={<div className="mx-auto h-[70vh] max-w-4xl animate-pulse px-4 pt-10 sm:px-6" aria-hidden="true" />}>
      <Month params={params} />
    </Suspense>
  );
}

async function Month({ params }: Props) {
  const { month } = await params;
  const [r, months] = await Promise.all([skillsReport(month), reportMonths()]);
  if (!r) notFound();
  return <SkillsReportView r={r} months={months} />;
}
