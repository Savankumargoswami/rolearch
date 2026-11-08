"use client";

import { Check, Loader2, Mail } from "lucide-react";
import { useState, useTransition } from "react";
import { subscribe } from "@/app/blog/actions";

type Option = { key: string; name: string };

/** Email updates for new blog articles: all industries or one. Double opt-in (see subscribe). */
export function BlogSubscribe({ industries, initial = "all", tone = "light" }: { industries: Option[]; initial?: string; tone?: "light" | "ink" }) {
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, start] = useTransition();
  const ink = tone === "ink";
  if (result?.ok)
    return (
      <p role="status" className={`flex items-start gap-2 rounded-2xl p-4 font-medium ${ink ? "bg-white/10" : "bg-[#1f7a4d]/10 text-[#1f7a4d]"}`}>
        <Check aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        {result.message}
      </p>
    );
  return (
    <form
      action={(fd) => start(async () => setResult(await subscribe(fd)))}
      className="flex flex-col gap-2"
    >
      <div className="flex flex-col gap-2 sm:flex-row">
        <label className="sr-only" htmlFor="blog-email">
          Email address
        </label>
        <input
          id="blog-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@example.com"
          className={`min-h-12 flex-1 rounded-full border px-4 ${ink ? "border-white/25 bg-white/10 text-paper placeholder:text-[#9fb0c3]" : "border-line bg-white"}`}
        />
        <label className="sr-only" htmlFor="blog-industry">
          Topic
        </label>
        <select
          id="blog-industry"
          name="industry"
          defaultValue={initial}
          className={`min-h-12 rounded-full border px-4 ${ink ? "border-white/25 bg-white/10 text-paper [&>option]:text-ink" : "border-line bg-white"}`}
        >
          <option value="all">Every industry</option>
          {industries.map((i) => (
            <option key={i.key} value={i.key}>
              {i.name}
            </option>
          ))}
        </select>
        {/* Hidden from people; bots fill it in. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
        <button
          type="submit"
          disabled={busy}
          className={`inline-flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-full px-5 font-medium transition-transform active:scale-[0.96] disabled:opacity-70 ${ink ? "bg-signal text-ink" : "bg-ink text-paper hover:bg-ink-hover"}`}
        >
          {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : <Mail aria-hidden="true" className="size-4" />}
          Get new articles
        </button>
      </div>
      <p className={`text-xs ${ink ? "text-[#c9d2de]" : "text-muted"}`}>
        One email per new article, about every other day. Confirm by email first; unsubscribe with one click.
      </p>
      {result && !result.ok && (
        <p role="alert" className="text-sm text-[#b4532a]">
          {result.message}
        </p>
      )}
    </form>
  );
}
