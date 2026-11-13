// Local preview of the weekly competitor watch: runs the research and writes the email to a file (sends nothing).
//   npx -y tsx@4.20.3 --env-file=.env.staging --conditions=react-server scripts/competitor-watch-preview.mts out.html
import { writeFileSync } from "node:fs";

// The app's modules are CommonJS to tsx; take their exports from the namespace (as scripts/blog-draft.mts does).
const load = async (p: string) => {
  const m = await import(p);
  return m.default ?? m;
};
const { runWatch, watchEmail } = await load("../src/lib/competitor-watch.ts");

const out = process.argv[2] ?? "competitor-watch.html";
const t = Date.now();
const result = await runWatch({});
const mail = watchEmail(new Date().toISOString().slice(0, 10), result);
writeFileSync(out, mail.html);
console.log(mail.subject);
console.log(
  `${Math.round((Date.now() - t) / 1000)} s; sources per competitor: ${result.reports.map((r: { competitor: string; sources: number }) => `${r.competitor} ${r.sources}`).join(", ")}; failed: ${result.failed.join(", ") || "none"}`,
);
