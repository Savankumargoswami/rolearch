"use client";

import { Check, Copy, UsersRound } from "lucide-react";
import { useState } from "react";

// "Reach the hiring team": links that open LinkedIn's own people search (the member searches, signed in to their
// own account; Rolearch reads nothing from LinkedIn) and a short message they can copy.

/** "Senior Mechanical Engineer II (Hybrid) - Dallas" -> "Mechanical Engineer". */
export function roleCore(title: string) {
  return title
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\s[-–—|,:/].*$/, "")
    .replace(/\b(senior|sr|junior|jr|staff|lead|principal|associate|entry[- ]level|intern(ship)?|i{1,3}|iv|v|\d+)\b\.?/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const search = (keywords: string) => `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(keywords)}`;

export function HiringTeam({ title, company }: { title: string; company: string }) {
  const role = roleCore(title) || title;
  const [copied, setCopied] = useState(false);
  const message = `Hi [Name], I just applied for the ${title} role at ${company}. My background in [your most relevant experience] lines up well with what the team is looking for. Would you be open to a quick chat, or could you point me to the right person on the team? Thank you!`;
  const links = [
    { label: `Recruiters at ${company}`, href: search(`recruiter ${company}`) },
    { label: `${role} managers at ${company}`, href: search(`${role} manager ${company}`) },
    { label: `The ${role} team at ${company} (for a referral)`, href: search(`${role} ${company}`) },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }

  return (
    <section aria-labelledby="hiring-team-h" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="hiring-team-h" className="flex items-center gap-2 font-semibold">
        <UsersRound aria-hidden="true" className="size-5 text-signal-ink" />
        Reach the hiring team
      </h2>
      <p className="mt-1 text-sm text-muted">A short note to a recruiter or the hiring manager after you apply can get your application read sooner.</p>
      <ul className="mt-3 flex flex-col gap-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-9 items-center font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
              {l.label} on LinkedIn ↗
            </a>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-xl bg-ink-soft p-3 text-sm">
        <p className="leading-relaxed">{message}</p>
        <button type="button" onClick={copy} className="mt-2 inline-flex min-h-9 cursor-pointer items-center gap-1.5 font-medium underline underline-offset-4">
          {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
          {copied ? "Copied" : "Copy message"}
        </button>
      </div>
    </section>
  );
}
