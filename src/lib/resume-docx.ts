// Builds an ATS-friendly Word resume: one column, standard section headings, real bullet lists,
// plain text dates, no tables, text boxes, headers or images (all of which parsers misread).
import "server-only";
import { AlignmentType, BorderStyle, Document, Packer, Paragraph, TabStopType, TextRun } from "docx";
import type { ProfileData } from "./profile-schema";

const FONT = "Calibri";
const fmtMonth = (ym: string) => {
  const m = /^(\d{4})-(\d{2})$/.exec(ym);
  return m ? new Intl.DateTimeFormat("en", { month: "short", year: "numeric", timeZone: "UTC" }).format(Date.UTC(+m[1], +m[2] - 1)) : ym;
};

const run = (text: string, opts: { bold?: boolean; size?: number; color?: string; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size: opts.size ?? 21, bold: opts.bold, italics: opts.italics, color: opts.color });

const heading = (text: string) =>
  new Paragraph({
    spacing: { before: 220, after: 80 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "0E1F2F", space: 2 } },
    children: [run(text.toUpperCase(), { bold: true, size: 22, color: "0E1F2F" })],
  });

/** Text with a right-aligned part on the same line (dates), using a tab stop rather than a table. */
const line = (left: TextRun[], right: string, after = 0) =>
  new Paragraph({
    spacing: { after },
    tabStops: [{ type: TabStopType.RIGHT, position: 10466 }],
    children: [...left, ...(right ? [run(`\t${right}`, { color: "4B5A6E" })] : [])],
  });

const bullet = (text: string) => new Paragraph({ bullet: { level: 0 }, spacing: { after: 40 }, children: [run(text)] });

export async function resumeDocx(p: ProfileData, contact: { email: string; phone: string }): Promise<Buffer> {
  const r = p.resume;
  const children: Paragraph[] = [];

  children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(p.full_name || "Your Name", { bold: true, size: 36 })] }));
  const contactLine = [contact.email, contact.phone, p.location, ...p.links.filter((l) => l.url).map((l) => l.url.replace(/^https?:\/\/(www\.)?/, ""))].filter(Boolean).join("  |  ");
  if (contactLine) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(contactLine, { size: 19 })] }));
  if (p.headline) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 120 }, children: [run(p.headline, { italics: true })] }));

  if (r.skills.length) {
    children.push(heading("Skills"));
    children.push(new Paragraph({ children: [run(r.skills.join(", "))] }));
  }

  if (r.experience.length) {
    children.push(heading("Experience"));
    for (const e of r.experience) {
      const dates = [fmtMonth(e.start), e.current ? "Present" : fmtMonth(e.end)].filter(Boolean).join(" – ");
      children.push(line([run(e.title, { bold: true }), ...(e.company ? [run(` | ${e.company}`)] : [])], dates));
      if (e.location) children.push(new Paragraph({ spacing: { after: 40 }, children: [run(e.location, { color: "4B5A6E", size: 19 })] }));
      for (const b of e.bullets) children.push(bullet(b));
      children.push(new Paragraph({ spacing: { after: 80 }, children: [] }));
    }
  }

  if (r.projects.length) {
    children.push(heading("Projects"));
    for (const pr of r.projects) {
      children.push(new Paragraph({ children: [run(pr.name, { bold: true }), ...(pr.url ? [run(` | ${pr.url}`, { size: 19 })] : [])] }));
      if (pr.summary) children.push(bullet(pr.summary));
      if (pr.skills.length) children.push(new Paragraph({ spacing: { after: 80 }, children: [run(`Tools: ${pr.skills.join(", ")}`, { size: 19, color: "4B5A6E" })] }));
    }
  }

  if (r.education.length) {
    children.push(heading("Education"));
    for (const e of r.education) {
      children.push(line([run([e.degree, e.field].filter(Boolean).join(", "), { bold: true }), ...(e.school ? [run(` | ${e.school}`)] : [])], [e.start, e.end].filter(Boolean).join(" – "), 60));
    }
  }

  if (r.certifications.length) {
    children.push(heading("Certifications"));
    for (const c of r.certifications) {
      children.push(line([run(c.name, { bold: true }), ...(c.issuer ? [run(` | ${c.issuer}`)] : [])], fmtMonth(c.issued), 40));
    }
  }

  const doc = new Document({
    creator: "Rolearch",
    title: `${p.full_name || "Resume"} – Resume`,
    styles: { default: { document: { run: { font: FONT, size: 21 } } } },
    sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 720, right: 720 } } }, children }],
  });
  return Packer.toBuffer(doc);
}
