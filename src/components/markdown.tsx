import Link from "next/link";
import type { ReactNode } from "react";

// A small, safe markdown renderer for blog articles: ## and ### headings, paragraphs, - and 1. lists, **bold**,
// *italic* and [links](url). It builds React elements (no raw HTML), and only http(s) or site-relative links render.

function inline(text: string, key: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${key}-${i++}`;
    if (m[1]) out.push(<strong key={k}>{m[1]}</strong>);
    else if (m[2]) out.push(<em key={k}>{m[2]}</em>);
    else if (m[4].startsWith("/"))
      out.push(
        <Link key={k} href={m[4]} className="font-medium underline decoration-signal decoration-2 underline-offset-4 hover:decoration-ink">
          {m[3]}
        </Link>,
      );
    else if (/^https?:\/\//.test(m[4]))
      out.push(
        <a key={k} href={m[4]} rel="noopener noreferrer nofollow" target="_blank" className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink">
          {m[3]}
        </a>,
      );
    else out.push(m[3]);
    last = re.lastIndex;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export const headingId = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Section headings, for a table of contents. */
export const headings = (md: string) => md.split("\n").flatMap((l) => (l.startsWith("## ") ? [l.slice(3).trim()] : []));

export function Markdown({ source }: { source: string }) {
  const blocks: ReactNode[] = [];
  const lines = source.replace(/\r/g, "").split("\n");
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    const k = `b${blocks.length}`;
    if (para.length) blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
    para = [];
    if (list) {
      const items = list.items.map((it, i) => <li key={i}>{inline(it, `${k}-${i}`)}</li>);
      blocks.push(list.ordered ? <ol key={`${k}l`}>{items}</ol> : <ul key={`${k}l`}>{items}</ul>);
      list = null;
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*]\s+(.*)$/.exec(line);
    const num = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (!line.trim()) flush();
    else if (line.startsWith("### ")) {
      flush();
      blocks.push(<h3 key={`b${blocks.length}`}>{inline(line.slice(4), `h${blocks.length}`)}</h3>);
    } else if (line.startsWith("## ")) {
      flush();
      const text = line.slice(3).trim();
      blocks.push(
        <h2 key={`b${blocks.length}`} id={headingId(text)}>
          {inline(text, `h${blocks.length}`)}
        </h2>,
      );
    } else if (bullet || num) {
      if (para.length) flush();
      const ordered = Boolean(num);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((bullet ?? num)![1]);
    } else if (list && /^\s{2,}/.test(raw)) list.items[list.items.length - 1] += ` ${line.trim()}`;
    else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return <div className="prose-article">{blocks}</div>;
}
