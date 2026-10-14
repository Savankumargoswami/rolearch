import type { JobLite, Salary } from "@/data/types";
import { locale } from "@/i18n";

const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

/** "2 days ago", "yesterday", "last week", "3 months ago" in the active locale. */
export function postedAgo(days: number): string {
  if (days >= 365) return relative.format(-Math.floor(days / 365), "year");
  if (days >= 60) return relative.format(-Math.floor(days / 30), "month");
  if (days >= 7) return relative.format(-Math.round(days / 7), "week");
  return relative.format(-days, "day");
}

/** Salary in the job's own currency, compact: "€68K–85K / yr", "₹24L–36L" style per locale. */
export function salaryRange(salary: Salary): string {
  const fmt = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: salary.currency,
    notation: "compact",
    maximumFractionDigits: 1,
  });
  const range = typeof fmt.formatRange === "function" ? fmt.formatRange(salary.min, salary.max) : `${fmt.format(salary.min)}–${fmt.format(salary.max)}`;
  const per = new Intl.DisplayNames(locale, { type: "dateTimeField" }).of(salary.period) ?? salary.period;
  return `${range} / ${per.toLowerCase()}`;
}

export function count(n: number): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** "Berlin, Germany", "Singapore", or the remote scope ("Europe time zones"). */
export function place(job: Pick<JobLite, "city" | "country">): string {
  if (job.city === "Remote") return job.country;
  if (job.city === job.country) return job.city;
  return `${job.city}, ${job.country}`;
}
