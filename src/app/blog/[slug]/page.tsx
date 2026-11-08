import { ArrowRight, BadgeCheck, Clock, FileSearch, Map } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { BlogSubscribe } from "@/components/blog-subscribe";
import { Markdown, headingId, headings } from "@/components/markdown";
import { INDUSTRIES, SITE, formatDate, getPost, industry, listPosts, postUrl } from "@/lib/blog";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const p = await getPost((await params).slug);
  if (!p) return { robots: { index: false } };
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: "article", title: p.title, description: p.description, url: postUrl(p.slug), publishedTime: p.published_at },
    twitter: { card: "summary_large_image", title: p.title, description: p.description },
  };
}

export default function ArticlePage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<div className="mx-auto h-[80vh] max-w-3xl animate-pulse px-4 pt-10" aria-hidden="true" />}>
      <Article params={params} />
    </Suspense>
  );
}

const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

async function Article({ params }: { params: Params }) {
  const p = await getPost((await params).slug);
  if (!p) notFound();
  const ind = industry(p.industry);
  const toc = headings(p.body);
  const more = (await listPosts(undefined, 7)).filter((x) => x.slug !== p.slug).slice(0, 3);
  const ld = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description: p.description,
      datePublished: p.published_at,
      dateModified: p.published_at,
      mainEntityOfPage: postUrl(p.slug),
      author: { "@type": "Organization", name: "Rolearch Research", url: SITE },
      publisher: { "@type": "Organization", name: "Rolearch", url: SITE, logo: { "@type": "ImageObject", url: `${SITE}/brand/logo.svg` } },
      about: ind?.name,
      keywords: p.skills.join(", "),
      citation: p.sources.map((s) => s.url),
    },
    ...(p.faq.length
      ? [
          {
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: p.faq.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
          },
        ]
      : []),
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: `${SITE}/blog` },
        { "@type": "ListItem", position: 2, name: p.title, item: postUrl(p.slug) },
      ],
    },
  ];

  return (
    <article className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }} />
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link href="/blog" className="hover:text-ink">
          Blog
        </Link>
        {ind && (
          <>
            {" / "}
            <Link href={`/blog?industry=${ind.key}`} className="hover:text-ink">
              {ind.name}
            </Link>
          </>
        )}
      </nav>
      <header className="mt-4 max-w-3xl">
        <h1 className="font-display text-4xl font-semibold leading-[1.05] tracking-[-0.03em] text-balance sm:text-5xl">{p.title}</h1>
        <p className="mt-4 text-lg text-muted text-pretty">{p.description}</p>
        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
          <span>By Rolearch Research</span>
          <time dateTime={p.published_at}>{formatDate(p.published_at)}</time>
          <span className="inline-flex items-center gap-1">
            <Clock aria-hidden="true" className="size-3.5" />
            {p.reading_minutes} min read
          </span>
          <span>{p.sources.length} sources</span>
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 max-w-3xl">
          {p.key_points.length > 0 && (
            <section aria-labelledby="key-h" className="rounded-3xl border border-line bg-surface p-6">
              <h2 id="key-h" className="font-display text-lg font-semibold">
                Key points
              </h2>
              <ul className="mt-3 flex flex-col gap-2">
                {p.key_points.map((k) => (
                  <li key={k} className="flex gap-2.5">
                    <span aria-hidden="true" className="mt-2.5 size-1.5 shrink-0 rounded-full bg-signal" />
                    {k}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="mt-8">
            <Markdown source={p.body} />
          </div>

          {p.skills.length > 0 && (
            <section aria-labelledby="skills-h" className="mt-10">
              <h2 id="skills-h" className="font-display text-xl font-semibold">
                Skills in this article
              </h2>
              <ul className="mt-3 flex flex-wrap gap-2">
                {p.skills.map((s) => (
                  <li key={s}>
                    <Link
                      href={`/jobs?q=${encodeURIComponent(s)}`}
                      className="inline-flex min-h-9 items-center rounded-full border border-line bg-surface px-3 text-sm hover:border-ink"
                    >
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {p.faq.length > 0 && (
            <section aria-labelledby="faq-h" className="mt-12">
              <h2 id="faq-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
                Questions people also ask
              </h2>
              <div className="mt-4 divide-y divide-line rounded-3xl border border-line bg-surface">
                {p.faq.map((f) => (
                  <details key={f.q} className="group px-5 py-4">
                    <summary className="flex min-h-8 cursor-pointer list-none items-center justify-between gap-3 font-medium [&::-webkit-details-marker]:hidden">
                      {f.q}
                      <span aria-hidden="true" className="text-xl text-muted transition-transform group-open:rotate-45">
                        +
                      </span>
                    </summary>
                    <p className="mt-2 text-muted">{f.a}</p>
                  </details>
                ))}
              </div>
            </section>
          )}

          <section aria-labelledby="src-h" className="mt-12">
            <h2 id="src-h" className="font-display text-xl font-semibold">
              Sources
            </h2>
            <ol className="mt-3 list-decimal space-y-1.5 ps-5 text-sm text-muted">
              {p.sources.map((s) => (
                <li key={s.url}>
                  <a href={s.url} rel="noopener noreferrer nofollow" target="_blank" className="underline decoration-ink/25 underline-offset-4 hover:text-ink">
                    {s.title}
                  </a>{" "}
                  <span className="text-xs">({host(s.url)})</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-xs text-muted">
              Researched and written with AI assistance by Rolearch Research. Figures come from the sources listed and from jobs posted on Rolearch. Spotted an
              error?{" "}
              <Link href="/feedback" className="underline underline-offset-4">
                Tell us
              </Link>
              .
            </p>
          </section>

          <section className="mt-12 grid gap-3 sm:grid-cols-3">
            {[
              { href: "/ats", icon: FileSearch, title: "Check your fit", text: "See which requirements your resume proves for any job." },
              { href: "/skills", icon: BadgeCheck, title: "Prove a skill", text: "Take a proctored test and earn a verified badge." },
              { href: "/roadmaps", icon: Map, title: "Plan what to learn", text: "Learning roadmaps for hundreds of roles." },
            ].map((c) => (
              <Link key={c.href} href={c.href} className="group rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-ink">
                <c.icon aria-hidden="true" className="size-5 text-signal-ink" />
                <span className="mt-2 flex items-center gap-1 font-semibold">
                  {c.title}
                  <ArrowRight aria-hidden="true" className="size-4 transition-transform group-hover:translate-x-0.5" />
                </span>
                <span className="mt-1 block text-sm text-muted">{c.text}</span>
              </Link>
            ))}
          </section>
        </div>

        <aside className="hidden lg:block">
          {toc.length > 2 && (
            <nav aria-label="In this article" className="sticky top-24 rounded-2xl border border-line bg-surface p-4">
              <p className="text-sm font-semibold">In this article</p>
              <ol className="mt-2 flex flex-col gap-1.5 text-sm">
                {toc.map((h) => (
                  <li key={h}>
                    <a href={`#${headingId(h)}`} className="text-muted hover:text-ink">
                      {h.replace(/\*\*/g, "")}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
        </aside>
      </div>

      <section aria-labelledby="sub-h" className="glass-ink mt-16 rounded-3xl p-6 text-paper sm:p-10">
        <h2 id="sub-h" className="max-w-[24ch] font-display text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          Get the next article in your inbox.
        </h2>
        <p className="mt-2 max-w-[56ch] text-[#c9d2de]">Researched, sourced, and focused on the skills employers are hiring for. Choose one industry or all of them.</p>
        <div className="mt-5 max-w-3xl">
          <BlogSubscribe industries={INDUSTRIES.map(({ key, name }) => ({ key, name }))} initial={ind?.key ?? "all"} tone="ink" />
        </div>
      </section>

      {more.length > 0 && (
        <section aria-labelledby="more-h" className="mt-16">
          <h2 id="more-h" className="font-display text-2xl font-semibold tracking-[-0.02em]">
            More from the blog
          </h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-3">
            {more.map((m) => (
              <li key={m.slug}>
                <Link href={`/blog/${m.slug}`} className="flex h-full flex-col rounded-2xl border border-line bg-surface p-5 hover:border-ink">
                  <span className="text-sm text-signal-ink">{industry(m.industry)?.name}</span>
                  <span className="mt-1 font-semibold text-balance">{m.title}</span>
                  <span className="mt-auto pt-3 text-xs text-muted">{formatDate(m.published_at)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
