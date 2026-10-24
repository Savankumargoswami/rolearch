// The layout of a downloaded resume, shared by the Word and PDF files so both read the same.
// Modelled on resumes that score well in Jobscan-style scanners: one column, centred contact block,
// standard upper-case headings with a rule, "Title | Company | Location" lines with dates on the right,
// real bullets, plain text dates. No tables, columns, text boxes, headers, footers or images.
import type { AtsDoc } from "./ats-doc";

export type Block =
  | { t: "name"; text: string }
  | { t: "center"; text: string; size: "headline" | "contact"; rule?: boolean }
  | { t: "heading"; text: string }
  | { t: "para"; text: string }
  | { t: "labeled"; label: string; text: string }
  | { t: "role"; bold: string; rest: string; right: string; plain?: boolean }
  | { t: "sub"; text: string; right: string }
  | { t: "bullet"; text: string }
  | { t: "small"; text: string }
  | { t: "letter"; text: string }
  | { t: "gap" };

/** Sizes in half-points (Word's unit): 20pt name, 12pt headings, 10.5pt body. */
export const SIZE = { name: 40, headline: 23, contact: 20, heading: 24, role: 22, sub: 21, body: 21, small: 20, date: 20 } as const;
// Black and near-black only: scanners flag coloured or grey text as hard to read. Bold is kept to the name,
// headings and job titles (also a scanner check).
export const COLOR = { ink: "000000", body: "111111", muted: "333333", rule: "000000" } as const;

const month = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1)) : ym;
};
const join = (parts: (string | undefined)[], sep = " | ") => parts.map((p) => (p ?? "").trim()).filter(Boolean).join(sep);
const bare = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

/** A cover letter: the same header as the resume, then the letter's paragraphs. */
export function letterBlocks(d: AtsDoc, contact: { email: string; phone: string }, paragraphs: string[]): Block[] {
  const reach = join([d.location, contact.email, contact.phone]);
  const date = new Intl.DateTimeFormat("en", { dateStyle: "long" }).format(new Date());
  return [
    { t: "name", text: (d.full_name || "Your Name").toUpperCase() },
    ...(reach ? [{ t: "center" as const, text: reach, size: "contact" as const, rule: true }] : []),
    { t: "letter", text: date },
    ...paragraphs.map((text) => ({ t: "letter" as const, text })),
  ];
}

export function resumeBlocks(d: AtsDoc, contact: { email: string; phone: string }): Block[] {
  const r = d.resume;
  const out: Block[] = [];

  out.push({ t: "name", text: (d.full_name || "Your Name").toUpperCase() });
  const lines: string[] = [];
  if (d.headline) lines.push(d.headline);
  const reach = join([d.location, contact.email, contact.phone]);
  const links = join(d.links.filter((l) => l.url).map((l) => bare(l.url)));
  out.push(...lines.map((text) => ({ t: "center" as const, text, size: "headline" as const })));
  const contactLines = [reach, links].filter(Boolean);
  contactLines.forEach((text, i) => out.push({ t: "center", text, size: "contact", rule: i === contactLines.length - 1 }));

  if (d.summary) {
    out.push({ t: "heading", text: "Professional Summary" }, { t: "para", text: d.summary });
  }

  const groups = d.skill_groups.filter((g) => g.items.length);
  if (groups.length || r.skills.length) {
    out.push({ t: "heading", text: groups.length > 1 ? "Technical Skills" : "Skills" });
    if (groups.length) for (const g of groups) out.push({ t: "labeled", label: g.label, text: g.items.join(", ") });
    else out.push({ t: "para", text: r.skills.join(", ") });
  }

  if (r.experience.length) {
    out.push({ t: "heading", text: "Professional Experience" });
    r.experience.forEach((e, i) => {
      if (i > 0) out.push({ t: "gap" });
      const dates = join([month(e.start), e.current ? "Present" : month(e.end)], " - ");
      out.push({ t: "role", bold: e.title, rest: join([e.company, e.location]), right: dates });
      for (const b of e.bullets) out.push({ t: "bullet", text: b });
    });
  }

  if (r.projects.length) {
    out.push({ t: "heading", text: "Key Projects" });
    r.projects.forEach((p, i) => {
      if (i > 0) out.push({ t: "gap" });
      out.push({ t: "role", bold: p.name, rest: p.url ? bare(p.url) : "", right: "", plain: true });
      if (p.summary) out.push({ t: "bullet", text: p.summary });
      if (p.skills.length) out.push({ t: "small", text: `Tools: ${p.skills.join(", ")}` });
    });
  }

  if (r.education.length) {
    out.push({ t: "heading", text: "Education" });
    for (const e of r.education) {
      out.push({ t: "role", bold: join([e.degree, e.field], ", "), rest: "", right: "", plain: true });
      out.push({ t: "sub", text: e.school, right: join([e.start, e.end], " - ") });
    }
  }

  if (r.certifications.length) {
    out.push({ t: "heading", text: "Certifications" });
    for (const c of r.certifications) {
      const when = join([c.issued && `Issued ${month(c.issued)}`, c.expires && `Expires ${month(c.expires)}`], ", ");
      out.push({ t: "para", text: join([join([c.name, c.issuer], " - "), when], ", ") });
    }
  }

  if (d.extra) {
    out.push({ t: "heading", text: "Additional Information" }, { t: "small", text: d.extra });
  }
  return out;
}
