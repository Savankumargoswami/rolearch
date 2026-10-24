// The same resume as a PDF, drawn from the shared layout with real, selectable text (ATS systems read the
// text layer; a picture of a resume scores zero). Standard Helvetica, one column, Letter size.
import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { AtsDoc } from "./ats-doc";
import { COLOR, SIZE, letterBlocks, resumeBlocks, type Block } from "./resume-layout";

const W = 612;
const H = 792;
const M = { top: 50, bottom: 50, x: 54 };
const pt = (halfPoints: number) => halfPoints / 2 - 0.5; // Helvetica runs a little wider than Calibri
const hex = (h: string) => rgb(parseInt(h.slice(0, 2), 16) / 255, parseInt(h.slice(2, 4), 16) / 255, parseInt(h.slice(4, 6), 16) / 255);

/** Standard PDF fonts only cover Western European text: fold accents, swap common symbols, drop the rest. */
function encodable(font: PDFFont) {
  const ok = new Map<string, string>();
  return (text: string) =>
    [...text.normalize("NFC")]
      .map((ch) => {
        if (ok.has(ch)) return ok.get(ch)!;
        let out = ch;
        try {
          font.encodeText(ch);
        } catch {
          const folded = ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
          out = folded !== ch && [...folded].every((c) => c.charCodeAt(0) < 128) ? folded : { "→": "->", "≥": ">=", "≤": "<=", "✓": "", "★": "*" }[ch] ?? "";
        }
        ok.set(ch, out);
        return out;
      })
      .join("");
}

export const resumePdf = (d: AtsDoc, contact: { email: string; phone: string }) => render(resumeBlocks(d, contact), d, `${d.full_name || "Resume"} - Resume`);

export const coverLetterPdf = (d: AtsDoc, contact: { email: string; phone: string }, paragraphs: string[]) =>
  render(letterBlocks(d, contact, paragraphs), d, `${d.full_name || "Cover letter"} - Cover letter`);

async function render(blocks: Block[], d: AtsDoc, title: string): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(title);
  pdf.setAuthor(d.full_name || "");
  pdf.setCreator("Rolearch");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const italic = await pdf.embedFont(StandardFonts.HelveticaOblique);
  const clean = encodable(regular);

  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M.top;
  const width = W - 2 * M.x;
  const need = (h: number) => {
    if (y - h < M.bottom) {
      page = pdf.addPage([W, H]);
      y = H - M.top;
    }
  };

  type Run = { text: string; font: PDFFont; size: number; color: string };
  const isSpace = (t: string) => /^\s+$/.test(t);
  const widthOf = (r: Run) => r.font.widthOfTextAtSize(isSpace(r.text) ? " " : r.text, r.size);

  /** Breaks runs into lines no wider than `room`, keeping each run's font; spaces stay in the text. */
  function lines(runs: Run[], room: number): Run[][] {
    const words = runs.flatMap((r) => clean(r.text).split(/(\s+)/).filter((w) => w.length).map((w) => ({ ...r, text: isSpace(w) ? " " : w })));
    const out: Run[][] = [];
    let line: Run[] = [];
    let lineW = 0;
    for (const w of words) {
      const ww = widthOf(w);
      if (!isSpace(w.text) && lineW + ww > room && line.length) {
        out.push(line);
        line = [];
        lineW = 0;
      }
      if (!line.length && isSpace(w.text)) continue;
      line.push(w);
      lineW += ww;
    }
    if (line.length) out.push(line);
    return out.map((l) => {
      while (l.length && isSpace(l[l.length - 1].text)) l.pop();
      return l;
    });
  }

  /** Draws one line. Neighbouring words in the same font go out as one string with real spaces, so text pulled
   * from the PDF (what an ATS reads) keeps its word breaks. */
  function drawLine(line: Run[], x: number, top: number, size: number) {
    let i = 0;
    while (i < line.length) {
      const r = line[i];
      let text = r.text;
      let j = i + 1;
      while (j < line.length && line[j].font === r.font && line[j].size === r.size && line[j].color === r.color) text += line[j++].text;
      page.drawText(text, { x, y: top - size, size: r.size, font: r.font, color: hex(r.color) });
      x += r.font.widthOfTextAtSize(text, r.size);
      i = j;
    }
  }
  const lineWidth = (line: Run[]) => line.reduce((sum, r) => sum + widthOf(r), 0);

  /** Writes runs of text, wrapping at the margin, and moves down past them. */
  function write(runs: Run[], opts: { center?: boolean; indent?: number; lead?: number } = {}) {
    const indent = opts.indent ?? 0;
    const size = Math.max(...runs.map((r) => r.size));
    const lineH = size * (opts.lead ?? 1.25);
    for (const line of lines(runs, width - indent)) {
      need(lineH);
      drawLine(line, M.x + indent + (opts.center ? (width - indent - lineWidth(line)) / 2 : 0), y, size);
      y -= lineH;
    }
  }

  const rule = (color: string, thickness: number) => {
    page.drawLine({ start: { x: M.x, y: y + 2 }, end: { x: W - M.x, y: y + 2 }, thickness, color: hex(color) });
  };

  /** A line with text on the left (wrapping short of the date) and an italic date pinned to the right margin. */
  function split(left: Run[], right: string) {
    const date = clean(right);
    const dateSize = pt(SIZE.date);
    const room = width - (date ? italic.widthOfTextAtSize(date, dateSize) + 12 : 0);
    const size = Math.max(...left.map((x) => x.size));
    const lineH = size * 1.25;
    lines(left, room).forEach((line, i) => {
      need(lineH);
      if (i === 0 && date) page.drawText(date, { x: W - M.x - italic.widthOfTextAtSize(date, dateSize), y: y - size, size: dateSize, font: italic, color: hex(COLOR.muted) });
      drawLine(line, M.x, y, size);
      y -= lineH;
    });
  }

  for (const b of blocks) {
    switch (b.t) {
      case "name":
        write([{ text: b.text, font: bold, size: pt(SIZE.name), color: COLOR.ink }], { center: true, lead: 1.15 });
        y -= 3;
        break;
      case "center":
        write([{ text: b.text, font: regular, size: pt(b.size === "headline" ? SIZE.headline : SIZE.contact), color: b.size === "headline" ? COLOR.body : COLOR.muted }], { center: true });
        y -= b.size === "headline" ? 2 : 1;
        if (b.rule) {
          y -= 2;
          rule("444444", 0.6);
          y -= 4;
        }
        break;
      case "heading":
        y -= 9;
        need(40);
        write([{ text: b.text.toUpperCase(), font: bold, size: pt(SIZE.heading), color: COLOR.ink }]);
        rule(COLOR.rule, 0.75);
        y -= 5;
        break;
      case "para":
        write([{ text: b.text, font: regular, size: pt(SIZE.body), color: COLOR.body }], { lead: 1.3 });
        y -= 2;
        break;
      case "labeled":
        write(
          [
            { text: `${b.label}: `, font: regular, size: pt(SIZE.body), color: COLOR.ink },
            { text: b.text, font: regular, size: pt(SIZE.body), color: COLOR.body },
          ],
          { lead: 1.3 },
        );
        y -= 1.5;
        break;
      case "role":
        y -= 4;
        need(30);
        split(
          [
            { text: b.bold, font: b.plain ? italic : bold, size: pt(SIZE.role), color: COLOR.ink },
            ...(b.rest ? [{ text: ` | ${b.rest}`, font: regular, size: pt(SIZE.role - 1), color: COLOR.body }] : []),
          ],
          b.right,
        );
        y -= 1;
        break;
      case "sub":
        split([{ text: b.text, font: regular, size: pt(SIZE.sub), color: COLOR.body }], b.right);
        y -= 2;
        break;
      case "bullet": {
        const size = pt(SIZE.body);
        need(size * 1.3);
        page.drawCircle({ x: M.x + 9, y: y - size * 0.62, size: 1.6, color: hex(COLOR.body) });
        write([{ text: b.text, font: regular, size, color: COLOR.body }], { indent: 18, lead: 1.3 });
        y -= 1.5;
        break;
      }
      case "small":
        write([{ text: b.text, font: regular, size: pt(SIZE.small), color: COLOR.muted }], { lead: 1.3 });
        y -= 2;
        break;
      case "letter":
        write([{ text: b.text, font: regular, size: 11, color: COLOR.body }], { lead: 1.45 });
        y -= 10;
        break;
      case "gap":
        y -= 3;
        break;
    }
  }
  return Buffer.from(await pdf.save());
}
