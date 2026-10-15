import { ArrowUpRight, BookOpen, ChartColumn, FolderGit2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { t } from "@/i18n";
import type { Post } from "@/lib/social";
import { Avatar } from "./avatar";
import { DeletePostButton } from "./delete-post-button";

const KIND = {
  project: { icon: FolderGit2, label: "posts.kindProject" },
  output: { icon: ChartColumn, label: "posts.kindOutput" },
  resource: { icon: BookOpen, label: "posts.kindResource" },
} as const;

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

export function PostCard({ post, viewerId, index = 0 }: { post: Post; viewerId: string; index?: number }) {
  const kind = KIND[post.kind];
  const Icon = kind.icon;
  const n = post.images.length;
  return (
    <article className="rise rounded-2xl border border-line bg-surface p-4 sm:p-5" style={{ "--delay": `${Math.min(index, 6) * 60}ms` } as React.CSSProperties}>
      <header className="flex items-start gap-3">
        <Link href={`/u/${post.author.id}`} className="shrink-0 rounded-full">
          <Avatar url={post.author.avatarUrl} name={post.author.name} size={44} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link href={`/u/${post.author.id}`} className="font-semibold hover:underline">
            {post.author.name}
          </Link>
          <p className="truncate text-sm text-muted">
            {[post.author.headline, post.ago].filter(Boolean).join(" · ")}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-soft px-2.5 py-1 text-xs font-semibold">
          <Icon aria-hidden="true" className="size-3.5 text-signal-ink" />
          {t(kind.label)}
        </span>
      </header>

      <p className="mt-3 leading-relaxed whitespace-pre-line break-words">{post.body}</p>

      {n > 0 && (
        <div className={`mt-3 grid gap-1.5 overflow-hidden rounded-xl ${n === 1 ? "" : "grid-cols-2"}`}>
          {post.images.map((src, i) => (
            <a
              key={src}
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className={`relative block bg-ink-soft ${n === 1 ? "aspect-[16/10]" : n === 3 && i === 0 ? "row-span-2 aspect-auto" : "aspect-square"}`}
            >
              <Image src={src} alt={t("posts.imageAlt", { n: i + 1 })} fill sizes="(min-width: 768px) 640px, 100vw" className="object-cover transition-transform duration-500 hover:scale-[1.03]" />
            </a>
          ))}
        </div>
      )}

      {post.link && (
        <a
          href={post.link}
          target="_blank"
          rel="noopener noreferrer nofollow ugc"
          className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line px-4 py-3 transition-colors duration-200 hover:border-ink"
        >
          <span className="min-w-0">
            <span className="block truncate font-medium">{host(post.link)}</span>
            <span className="block truncate text-sm text-muted">{post.link}</span>
          </span>
          <ArrowUpRight aria-hidden="true" className="size-4 shrink-0" />
        </a>
      )}

      {post.author.id === viewerId && (
        <footer className="mt-2 flex justify-end">
          <DeletePostButton id={post.id} />
        </footer>
      )}
    </article>
  );
}

export function PostList({ posts, viewerId, empty }: { posts: Post[]; viewerId: string; empty: string }) {
  if (posts.length === 0) return <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-muted">{empty}</p>;
  return (
    <div className="flex flex-col gap-4">
      {posts.map((p, i) => (
        <PostCard key={p.id} post={p} viewerId={viewerId} index={i} />
      ))}
    </div>
  );
}
