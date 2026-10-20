import Link from "next/link";
import { t } from "@/i18n";

/** Explains why someone can't post: not a company account, or a company whose email domain isn't verified. */
export function CompanyGate({ kind, site = "" }: { kind: "not-company" | "unverified"; site?: string }) {
  const company = kind === "not-company";
  return (
    <div role="note" className="mt-8 rounded-2xl border border-line bg-surface p-6">
      <h2 className="font-display text-xl font-semibold">{company ? t("hire.notCompanyTitle") : t("hire.unverifiedTitle")}</h2>
      <p className="mt-2 max-w-[60ch] text-muted">{company ? t("hire.notCompanyBody") : t("hire.unverifiedBody", { site: site || "your website" })}</p>
      {company && (
        <Link href="/signup?as=company" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("home.companiesCta")}
        </Link>
      )}
    </div>
  );
}
