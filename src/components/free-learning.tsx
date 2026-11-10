import { ArrowUpRight, BookOpen, PlayCircle, Sparkles } from "lucide-react";
import type { FreeLink, Resource } from "@/data/learning";
import { t } from "@/i18n";

/** One skill's free learning card: the curated course (if any), then searches on platforms that teach it. */
export function FreeLearningCard({ title, featured, links }: { title?: string; featured: Resource | null; links: FreeLink[] }) {
  return (
    <div className="flex flex-col rounded-2xl bg-paper/60 p-4">
      {title && <h3 className="font-display text-lg font-semibold">{title}</h3>}
      {featured && (
        <a
          href={featured.course.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group mt-3 flex items-start gap-3 rounded-xl bg-ink p-3 text-paper transition-transform duration-200 hover:-translate-y-0.5"
        >
          <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal" />
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-semibold tracking-wide text-signal uppercase">{t("match.featured")}</span>
            <span className="block font-medium">{featured.course.name}</span>
            <span className="block text-sm text-[#c9d2de]">{featured.course.by}</span>
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0 transition-transform duration-200 group-hover:rotate-45" />
        </a>
      )}
      <ul className="mt-3 flex flex-col gap-1">
        {links.map((l) => (
          <li key={l.url}>
            <a href={l.url} target="_blank" rel="noopener noreferrer" className="flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-[0.95rem] hover:bg-ink-soft">
              {l.kind === "video" ? (
                <PlayCircle aria-hidden="true" className="size-4 shrink-0 text-[#b4532a]" />
              ) : (
                <BookOpen aria-hidden="true" className="size-4 shrink-0 text-signal-ink" />
              )}
              <span className="min-w-0 flex-1 truncate">{l.by}</span>
              <ArrowUpRight aria-hidden="true" className="size-3.5 shrink-0 text-muted" />
            </a>
          </li>
        ))}
      </ul>
      {featured?.book && (
        <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
          <span className="font-medium text-ink">{t("match.book")}:</span> {featured.book}
        </p>
      )}
    </div>
  );
}
