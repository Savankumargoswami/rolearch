import { ArrowRight, Clock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { BlogSubscribe } from "@/components/blog-subscribe";
import { INDUSTRIES, formatDate, industry, listPosts } from "@/lib/blog";

export const metadata: Metadata = {
  title: "Blog: the skills each industry is hiring for",
  description:
    "Researched, sourced articles on which skills employers are hiring for, how AI is changing jobs, and how learning new skills helps you get hired, industry by industry. New articles every other day.",
  alternates: { canonical: "/blog", types: { "application/rss+xml": "/blog/rss.xml" } },
};

const options = INDUSTRIES.map(({ key, name }) => ({ key, name }));

export default function BlogPage({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <h1 className="max-w-[18ch] font-display text-4xl font-semibold tracking-[-0.03em] text-balance sm:text-6xl">
        Skills that get people hired, industry by industry.
      </h1>
      <p className="mt-4 max-w-[62ch] text-lg text-muted text-pretty">
        Researched answers to one question: which up-to-date skills help people get jobs in an AI-driven market, and how to learn them. Every article
        cites its sources and includes what employers on Rolearch are asking for right now. New articles every other day.
      </p>
      <div className="mt-6 max-w-3xl">
        <BlogSubscribe industries={options} />
      </div>
      <Suspense fallback={<div className="mt-12 h-96 animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Posts searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Posts({ searchParams }: { searchParams: Promise<{ industry?: string }> }) {
  const chosen = industry((await searchParams).industry ?? "")?.key;
  const posts = await listPosts(chosen);
  const lead = !chosen;
  return (
    <>
      <nav aria-label="Industries" className="rail -mx-4 mt-12 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        <Chip href="/blog" active={!chosen}>
          All industries
        </Chip>
        {INDUSTRIES.map((i) => (
          <Chip key={i.key} href={`/blog?industry=${i.key}`} active={chosen === i.key}>
            {i.name}
          </Chip>
        ))}
      </nav>
      {posts.length === 0 ? (
        <p className="mt-8 rounded-3xl border border-line bg-surface p-8 text-muted">
          {chosen
            ? "No articles for this industry yet. It's in the rotation: subscribe above to get it when it's published."
            : "The first articles are being researched. Subscribe above and we'll email you when they're published."}
        </p>
      ) : (
        <ul className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((p, i) => (
            <li key={p.slug} className={i === 0 && lead ? "md:col-span-2" : ""}>
              <Link
                href={`/blog/${p.slug}`}
                className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-6 transition-[border-color,translate] duration-200 hover:-translate-y-0.5 hover:border-ink"
              >
                <span className="text-sm font-medium text-signal-ink">{industry(p.industry)?.name ?? p.industry}</span>
                <span className={`mt-2 font-display font-semibold tracking-[-0.02em] text-balance ${i === 0 && lead ? "text-2xl sm:text-3xl" : "text-xl"}`}>
                  {p.title}
                </span>
                <span className="mt-2 line-clamp-3 text-muted">{p.description}</span>
                <span className="mt-auto flex items-center gap-3 pt-5 text-sm text-muted">
                  <time dateTime={p.published_at}>{formatDate(p.published_at)}</time>
                  <span className="inline-flex items-center gap-1">
                    <Clock aria-hidden="true" className="size-3.5" />
                    {p.reading_minutes} min read
                  </span>
                  <ArrowRight aria-hidden="true" className="ms-auto size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function Chip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-sm whitespace-nowrap transition-colors ${active ? "border-ink bg-ink text-paper" : "border-line bg-surface hover:border-ink"}`}
    >
      {children}
    </Link>
  );
}
