"use client";

import { Check, Copy } from "lucide-react";
import { useId, useState } from "react";

const BASE = "https://www.rolearch.com/students";

/** "your-school" from "Your School", for the link's campaign tag. */
const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);

/**
 * A link to /students tagged with the school's name, for its resources page or newsletter: visits from it show up
 * by school in the site's analytics (only utm_* tags are recorded), so we can tell a school how many students it sent.
 */
export function SchoolLink() {
  const id = useId();
  const [school, setSchool] = useState("");
  const [copied, setCopied] = useState(false);
  const tag = slug(school);
  const url = tag ? `${BASE}?utm_source=${tag}&utm_medium=career-center&utm_campaign=students` : BASE;

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked; the link is shown to copy by hand */
    }
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <label htmlFor={id} className="font-semibold">
        Your school
      </label>
      <input
        id={id}
        value={school}
        onChange={(e) => setSchool(e.target.value)}
        placeholder="e.g. Oklahoma Christian University"
        autoComplete="organization"
        className="mt-2 block min-h-11 w-full rounded-xl border border-line bg-paper px-3 text-base outline-none focus-visible:border-ink"
      />
      <p className="mt-4 text-sm text-muted">Your link</p>
      <p className="mt-1 rounded-xl bg-ink-soft px-3 py-2.5 font-mono text-sm break-all">{url}</p>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors duration-200 hover:bg-ink-hover active:scale-[0.96]"
      >
        {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
        {copied ? "Copied" : "Copy link"}
      </button>
      <p className="sr-only" aria-live="polite">
        {copied ? "Link copied" : ""}
      </p>
    </div>
  );
}
