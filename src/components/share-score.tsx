"use client";

import { Check, Download, Link2, Loader2, Share2 } from "lucide-react";
import { useState, useTransition } from "react";
import { shareLink } from "@/app/ats/actions";
import { t } from "@/i18n";

/** After a check: a public score card ("Resume scored 54 → 87 for Data Engineer") to post or send. */
export function ShareScore({ before, after, title }: { before: number | null; after: number; title: string }) {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [pending, start] = useTransition();
  const text = before !== null ? t("share.textImproved", { before, after, title }) : t("share.text", { after, title });

  function make() {
    start(async () => {
      const path = await shareLink(before, after, title).catch(() => null);
      if (!path) return;
      const full = new URL(path, window.location.origin).toString();
      setUrl(full);
      if (navigator.share && window.matchMedia("(pointer: coarse)").matches) {
        navigator.share({ title: "Rolearch", text, url: full }).catch(() => undefined);
      }
    });
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the link is still shown */
    }
  }

  const btn = "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full border border-line px-3.5 text-sm font-medium transition-colors hover:border-ink";
  return (
    <div className="mt-6 rounded-2xl bg-ink-soft p-4">
      <p className="font-semibold">{t("share.title")}</p>
      <p className="mt-1 text-sm text-muted">{t("share.lead")}</p>
      {!url ? (
        <button type="button" onClick={make} disabled={pending} className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:opacity-60">
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Share2 aria-hidden="true" className="size-4" />}
          {t("share.make")}
        </button>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- the generated card itself */}
          <img src={`${new URL(url).pathname}/card.png`} alt={text} width={1200} height={630} className="w-full rounded-xl border border-line" />
          <div className="flex flex-wrap gap-2">
            <a className={btn} href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
              LinkedIn
            </a>
            <a className={btn} href={`https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">
              X
            </a>
            <a className={btn} href={`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`} target="_blank" rel="noopener noreferrer">
              WhatsApp
            </a>
            <button type="button" onClick={copy} className={btn}>
              {copied ? <Check aria-hidden="true" className="size-4" /> : <Link2 aria-hidden="true" className="size-4" />}
              {copied ? t("share.copied") : t("share.copy")}
            </button>
            <a className={btn} href={`${new URL(url).pathname}/card.png`} download="rolearch-ats-score.png">
              <Download aria-hidden="true" className="size-4" />
              {t("share.image")}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
