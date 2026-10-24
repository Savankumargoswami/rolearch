// Builds an ATS-friendly Word resume from the shared layout: one column, standard section headings,
// real bullet lists, plain text dates, no tables, text boxes, headers or images (all of which parsers misread).
import "server-only";
import { AlignmentType, BorderStyle, Document, LevelFormat, Packer, Paragraph, TabStopType, TextRun } from "docx";
import type { AtsDoc } from "./ats-doc";
import { COLOR, SIZE, letterBlocks, resumeBlocks, type Block } from "./resume-layout";

const FONT = "Calibri";
// Letter page, 0.75" side margins: the right tab stop sits at the right margin.
const PAGE = { width: 12240, margin: { top: 1000, bottom: 1000, left: 1080, right: 1080 } };
const RIGHT = PAGE.width - PAGE.margin.left - PAGE.margin.right;

const run = (text: string, size: number, color: string, opts: { bold?: boolean; italics?: boolean } = {}) =>
  new TextRun({ text, font: FONT, size, color, bold: opts.bold, italics: opts.italics });

const rule = (color: string, size: number) => ({ bottom: { style: BorderStyle.SINGLE, size, color, space: 2 } });

function paragraph(b: Block): Paragraph {
  switch (b.t) {
    case "name":
      return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(b.text, SIZE.name, COLOR.name, { bold: true })] });
    case "center":
      return new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: b.rule ? 100 : b.size === "headline" ? 60 : 40 },
        border: b.rule ? rule("444444", 5) : undefined,
        children: [run(b.text, b.size === "headline" ? SIZE.headline : SIZE.contact, b.size === "headline" ? COLOR.body : COLOR.muted)],
      });
    case "heading":
      return new Paragraph({ spacing: { before: 220, after: 80 }, border: rule(COLOR.rule, 6), children: [run(b.text.toUpperCase(), SIZE.heading, COLOR.ink, { bold: true })] });
    case "para":
      return new Paragraph({ spacing: { before: 40, after: 40 }, children: [run(b.text, SIZE.body, COLOR.body)] });
    case "labeled":
      return new Paragraph({ spacing: { before: 44, after: 44 }, children: [run(`${b.label}: `, SIZE.body, COLOR.ink, { bold: true }), run(b.text, SIZE.body, COLOR.body)] });
    case "role":
      return new Paragraph({
        spacing: { before: 120, after: 55 },
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }],
        children: [
          run(b.bold, SIZE.role, COLOR.ink, { bold: !b.plain, italics: b.plain }),
          ...(b.rest ? [run(` | ${b.rest}`, SIZE.role - 1, COLOR.ink)] : []),
          ...(b.right ? [run(`\t${b.right}`, SIZE.date, COLOR.muted, { italics: true })] : []),
        ],
      });
    case "sub":
      return new Paragraph({
        spacing: { after: 60 },
        tabStops: [{ type: TabStopType.RIGHT, position: RIGHT }],
        children: [run(b.text, SIZE.sub, COLOR.body), ...(b.right ? [run(`\t${b.right}`, SIZE.date, COLOR.muted, { italics: true })] : [])],
      });
    case "bullet":
      return new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { before: 44, after: 44 }, children: [run(b.text, SIZE.body, COLOR.body)] });
    case "small":
      return b.rule
        ? new Paragraph({ spacing: { before: 120, after: 40 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 4 } }, children: [run(b.text, SIZE.fine, COLOR.muted)] })
        : new Paragraph({ spacing: { before: 10, after: 60 }, children: [run(b.text, SIZE.small, COLOR.muted)] });
    case "letter":
      return new Paragraph({ spacing: { before: 0, after: 220, line: 300 }, children: [run(b.text, 22, COLOR.body)] });
    case "gap":
      return new Paragraph({ spacing: { before: 0, after: 0 }, children: [] });
  }
}

export const resumeDocx = (d: AtsDoc, contact: { email: string; phone: string }) => render(resumeBlocks(d, contact), `${d.full_name || "Resume"} - Resume`);

export const coverLetterDocx = (d: AtsDoc, contact: { email: string; phone: string }, paragraphs: string[]) =>
  render(letterBlocks(d, contact, paragraphs), `${d.full_name || "Cover letter"} - Cover letter`);

async function render(blocks: Block[], title: string): Promise<Buffer> {
  const doc = new Document({
    creator: "Rolearch",
    title,
    styles: { default: { document: { run: { font: FONT, size: SIZE.body } } } },
    numbering: {
      config: [
        {
          reference: "bullets",
          levels: [{ level: 0, format: LevelFormat.BULLET, text: "-", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }],
        },
      ],
    },
    sections: [{ properties: { page: { size: { width: PAGE.width, height: 15840 }, margin: PAGE.margin } }, children: blocks.map(paragraph) }],
  });
  return Packer.toBuffer(doc);
}
