// A job description stored as plain text, shown as paragraphs and bullet lists, with the long tail
// folded behind "Show the full description" so the page stays scannable.

type Block = { kind: "p" | "list" | "heading"; lines: string[] };

const HEADING = /^(about|what you|who you|your role|responsibilit|requirements|qualifications|minimum|preferred|basic|key|job description|the role|role overview|benefits|what we|why|you will|you'll|you have|skills|education|experience|duties|essential|additional|compensation|pay|location|summary)/i;

function blocks(text: string): Block[] {
  const out: Block[] = [];
  for (const para of text.replace(/\r/g, "").split(/\n\s*\n/)) {
    const lines = para.split("\n").map((l) => l.replace(/^[\s•·▪●◦*\-–]+/, "").trim()).filter(Boolean);
    if (!lines.length) continue;
    // A short line ending in ":" (or a known section name) reads as a heading for what follows.
    if (lines.length >= 1 && lines[0].length <= 70 && (lines[0].endsWith(":") || (HEADING.test(lines[0]) && lines[0].split(" ").length <= 6))) {
      out.push({ kind: "heading", lines: [lines[0].replace(/:$/, "")] });
      lines.shift();
      if (!lines.length) continue;
    }
    const listy = lines.length >= 2 && lines.every((l) => l.length <= 260);
    out.push({ kind: listy ? "list" : "p", lines: listy ? lines : [lines.join(" ")] });
  }
  return out;
}

function Render({ items }: { items: Block[] }) {
  return (
    <>
      {items.map((b, i) =>
        b.kind === "heading" ? (
          <h3 key={i} className="mt-6 font-semibold first:mt-0">
            {b.lines[0]}
          </h3>
        ) : b.kind === "list" ? (
          <ul key={i} className="mt-3 flex flex-col gap-2">
            {b.lines.map((l, j) => (
              <li key={j} className="flex gap-3">
                <span aria-hidden="true" className="mt-[0.6em] size-1.5 shrink-0 rounded-full bg-signal" />
                <span className="min-w-0">{l}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p key={i} className="mt-3 first:mt-0">
            {b.lines[0]}
          </p>
        ),
      )}
    </>
  );
}

export function JobDescription({ text, moreLabel }: { text: string; moreLabel: string }) {
  const all = blocks(text);
  // Show roughly the first 1,400 characters, then fold the rest.
  let used = 0;
  let cut = all.length;
  for (let i = 0; i < all.length; i++) {
    used += all[i].lines.join(" ").length;
    if (used > 1400 && i < all.length - 1) {
      cut = i + 1;
      break;
    }
  }
  const head = all.slice(0, cut);
  const rest = all.slice(cut);
  return (
    <div className="max-w-[68ch] leading-relaxed text-ink/90">
      <Render items={head} />
      {rest.length > 0 && (
        <details className="group mt-4">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-full border border-ink px-4 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper group-open:hidden [&::-webkit-details-marker]:hidden">
            {moreLabel}
          </summary>
          <div className="mt-3">
            <Render items={rest} />
          </div>
        </details>
      )}
    </div>
  );
}
