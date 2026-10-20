import Link from "next/link";
import { t } from "@/i18n";
import { Logo } from "./logo";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-line bg-paper">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo height={30} />
          <p className="mt-4 max-w-xs font-display text-lg font-medium tracking-[-0.01em]">{t("brand.tagline")}</p>
          <p className="mt-1 max-w-xs text-muted">{t("footer.tagline")}</p>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t("footer.product")}</h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li><Link className="hover:text-ink" href="/jobs">{t("nav.jobs")}</Link></li>
            <li><Link className="hover:text-ink" href="/#companies">{t("nav.companies")}</Link></li>
            <li><Link className="hover:text-ink" href="/signup">{t("nav.signUp")}</Link></li>
          </ul>
        </div>
        <div>
          <h2 className="text-sm font-semibold">{t("footer.company")}</h2>
          <ul className="mt-3 space-y-2 text-muted">
            <li><a className="hover:text-ink" href="mailto:admin@rolearch.com">{t("footer.contact")}</a></li>
            <li><Link className="hover:text-ink" href="/privacy">{t("footer.privacy")}</Link></li>
            <li><Link className="hover:text-ink" href="/terms">{t("footer.terms")}</Link></li>
          </ul>
        </div>
      </div>
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pb-8 text-sm text-muted sm:px-6">
        <p className="max-w-[80ch]">{t("footer.emailNotice")}</p>
        <p>{t("footer.rights", { y: 2026 })}</p>
      </div>
    </footer>
  );
}
