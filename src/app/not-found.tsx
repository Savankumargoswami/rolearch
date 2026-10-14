import Link from "next/link";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
      <h1 className="font-display text-5xl font-semibold tracking-[-0.03em]">{t("notFound.title")}</h1>
      <p className="mt-3 text-lg text-muted">{t("notFound.body")}</p>
      <Link href="/jobs" className="mt-8 inline-flex min-h-12 items-center rounded-full bg-ink px-6 font-medium text-paper hover:bg-ink-hover">
        {t("notFound.cta")}
      </Link>
    </div>
  );
}
