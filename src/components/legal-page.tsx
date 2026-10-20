import { FileText } from "lucide-react";
import Link from "next/link";

export type LegalSection = { id: string; title: string; body: React.ReactNode };

/** Shared layout for the Privacy Policy and Terms: a plain-language summary, a contents list, then numbered sections. */
export function LegalPage({
  title,
  updated,
  summary,
  sections,
  other,
}: {
  title: string;
  updated: string;
  summary: string[];
  sections: LegalSection[];
  other: { href: string; label: string };
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6 sm:py-16">
      <p className="inline-flex items-center gap-2 rounded-full bg-ink-soft px-3 py-1 text-sm font-medium">
        <FileText aria-hidden="true" className="size-4" />
        Last updated {updated}
      </p>
      <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{title}</h1>

      <div className="mt-8 rounded-3xl bg-ink p-6 text-paper sm:p-8">
        <h2 className="font-display text-xl font-semibold">In short</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {summary.map((s) => (
            <li key={s} className="flex gap-3 leading-relaxed text-[#dfe5ec]">
              <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-signal" />
              {s}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[14rem_minmax(0,1fr)]">
        <nav aria-label="Contents" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold tracking-wide text-signal-ink uppercase">Contents</p>
          <ol className="mt-3 flex flex-col gap-1 text-[0.95rem]">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="flex gap-2 rounded-lg px-2 py-1.5 text-muted hover:bg-ink-soft hover:text-ink">
                  <span className="tabular-nums">{i + 1}.</span>
                  {s.title}
                </a>
              </li>
            ))}
          </ol>
          <Link href={other.href} className="mt-4 inline-block px-2 text-[0.95rem] font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
            {other.label}
          </Link>
        </nav>

        <div className="min-w-0">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-24 border-t border-line py-8 first:border-t-0 first:pt-0">
              <h2 id={`${s.id}-h`} className="font-display text-2xl font-semibold tracking-[-0.02em]">
                <span className="me-2 text-signal-ink tabular-nums">{i + 1}.</span>
                {s.title}
              </h2>
              <div className="legal mt-4 max-w-[68ch] space-y-4 leading-relaxed text-ink/90">{s.body}</div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Bulleted list styled for legal text. */
export function Points({ items }: { items: React.ReactNode[] }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-signal" />
          <span className="min-w-0">{item}</span>
        </li>
      ))}
    </ul>
  );
}

export const CONTACT_EMAIL = "admin@rolearch.com";
/** The only address Rolearch sends account email from. It isn't read; replies go nowhere. */
export const NOREPLY_EMAIL = "noreply@rolearch.com";

export function Mail() {
  return (
    <a href={`mailto:${CONTACT_EMAIL}`} className="font-medium underline decoration-line underline-offset-4 hover:decoration-ink">
      {CONTACT_EMAIL}
    </a>
  );
}
