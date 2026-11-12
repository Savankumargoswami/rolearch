"use client";

import { ArrowUpRight, Puzzle } from "lucide-react";
import { useSyncExternalStore } from "react";
import { t } from "@/i18n";

/** The Rolearch extension on the Chrome Web Store (installs in Chrome and Edge). */
export const CHROME_EXTENSION_URL = "https://chromewebstore.google.com/detail/rolearch-job-fit-check/akhdgfgllafnahhcadonigeelebeaeif";

const noop = () => () => {};

/** Desktop Chrome, Edge or another Chromium browser: where the extension can be installed. */
function canInstall(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean; brands?: { brand: string }[] } };
  if (nav.userAgentData) return !nav.userAgentData.mobile && (nav.userAgentData.brands ?? []).some((b) => /chrom|edge/i.test(b.brand));
  const ua = navigator.userAgent;
  return /Chrome\/|Edg\//.test(ua) && !/Mobile|Android|iPhone|iPad/.test(ua);
}

/**
 * "Add to Chrome" for the Rolearch extension. Only shown where it can be installed (desktop Chromium browsers), and
 * only after hydration, so other browsers never see a button they can't use.
 * pill: next to the home hero links. banner: a short pitch with the button (free check, features). link: a footer link.
 */
export function AddToChrome({
  variant = "pill",
  className = "",
  asListItem = false,
}: {
  variant?: "pill" | "banner" | "link";
  className?: string;
  /** link only: wrap in <li> (so a list never gets an empty item where the button is hidden). */
  asListItem?: boolean;
}) {
  const show = useSyncExternalStore(noop, canInstall, () => false);
  if (!show) return null;
  const common = { href: CHROME_EXTENSION_URL, target: "_blank", rel: "noopener noreferrer" } as const;

  if (variant === "link") {
    const link = (
      <a {...common} className={`hover:text-ink ${className}`}>
        {t("chromeExt.footer")}
        <span className="sr-only"> {t("chromeExt.newTab")}</span>
      </a>
    );
    return asListItem ? <li>{link}</li> : link;
  }
  if (variant === "banner") {
    return (
      <aside className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5 ${className}`}>
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-signal/15">
            <Puzzle aria-hidden="true" className="size-5 text-ink" />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{t("chromeExt.title")}</p>
            <p className="mt-0.5 max-w-[56ch] text-sm text-pretty text-muted">{t("chromeExt.lead")}</p>
          </div>
        </div>
        <a
          {...common}
          className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors duration-200 hover:bg-ink-hover"
        >
          {t("chromeExt.button")}
          <ArrowUpRight aria-hidden="true" className="size-4" />
          <span className="sr-only">{t("chromeExt.newTab")}</span>
        </a>
      </aside>
    );
  }
  return (
    <a
      {...common}
      className={`inline-flex min-h-11 items-center gap-2 rounded-full border border-ink/25 px-4 text-sm font-medium transition-colors duration-200 hover:border-ink ${className}`}
    >
      <Puzzle aria-hidden="true" className="size-4" />
      {t("chromeExt.button")}
      <ArrowUpRight aria-hidden="true" className="size-4" />
      <span className="sr-only">{t("chromeExt.newTab")}</span>
    </a>
  );
}
