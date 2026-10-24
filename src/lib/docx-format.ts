// Reads the layout of an uploaded Word resume (not its words) for the formatting checks resume scanners run:
// tables, columns, images and text boxes, header/footer text, fonts, sizes, colours, bold, margins and page size.
import "server-only";
import JSZip from "jszip";

export type DocxFacts = {
  images: number;
  tables: number;
  columns: number;
  textBoxes: number;
  headerFooterText: boolean;
  fonts: string[];
  avgFontPt: number;
  /** Share of the text (by characters) in bold, and in a colour that isn't black or near-black. */
  boldShare: number;
  colourShare: number;
  /** Share of paragraphs centred or justified rather than left-aligned. */
  notLeftShare: number;
  margins: { top: number; bottom: number; left: number; right: number } | null;
  page: { width: number; height: number } | null;
  specialChars: number;
};

const attr = (xml: string, name: string) => new RegExp(`w:${name}="([^"]*)"`).exec(xml)?.[1];
const on = (tag: string | undefined) => tag !== undefined && !/w:val="(0|false|none)"/.test(tag);

/** Near-black text: every channel dark enough to read as black on paper. */
const dark = (hex: string) => hex === "auto" || !/^[0-9a-f]{6}$/i.test(hex) || [0, 2, 4].every((i) => parseInt(hex.slice(i, i + 2), 16) <= 0x40);

export async function docxFacts(bytes: Buffer): Promise<DocxFacts | null> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(bytes);
  } catch {
    return null;
  }
  const doc = await zip.file("word/document.xml")?.async("string");
  if (!doc) return null;
  const styles = (await zip.file("word/styles.xml")?.async("string")) ?? "";

  // Defaults the runs inherit: document defaults, then the Normal style.
  const defaults = /<w:docDefaults>[\s\S]*?<\/w:docDefaults>/.exec(styles)?.[0] ?? "";
  const normal = /<w:style [^>]*w:styleId="Normal"[\s\S]*?<\/w:style>/.exec(styles)?.[0] ?? "";
  const baseSize = Number(attr(normal.match(/<w:sz [^>]*>/)?.[0] ?? "", "val") ?? attr(defaults.match(/<w:sz [^>]*>/)?.[0] ?? "", "val") ?? 22) / 2;
  const baseFont = attr(normal.match(/<w:rFonts [^>]*>/)?.[0] ?? "", "ascii") ?? attr(defaults.match(/<w:rFonts [^>]*>/)?.[0] ?? "", "ascii") ?? "Calibri";

  let chars = 0;
  let bold = 0;
  let coloured = 0;
  let sizeSum = 0;
  const fonts = new Map<string, number>();
  const body = doc.replace(/<w:txbxContent>[\s\S]*?<\/w:txbxContent>/g, "");
  for (const run of body.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? []) {
    const text = (run.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join("");
    const n = text.replace(/\s/g, "").length;
    if (!n) continue;
    const rpr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(run)?.[0] ?? "";
    chars += n;
    if (on(rpr.match(/<w:b(?: [^>]*)?\/>/)?.[0])) bold += n;
    const colour = attr(rpr.match(/<w:color [^>]*>/)?.[0] ?? "", "val");
    if (colour && !dark(colour)) coloured += n;
    const sz = attr(rpr.match(/<w:sz [^>]*>/)?.[0] ?? "", "val");
    sizeSum += (sz ? Number(sz) / 2 : baseSize) * n;
    const font = attr(rpr.match(/<w:rFonts [^>]*>/)?.[0] ?? "", "ascii") ?? baseFont;
    fonts.set(font, (fonts.get(font) ?? 0) + n);
  }

  const paragraphs = doc.match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? [];
  const withText = paragraphs.filter((p) => /<w:t[^>]*>[^<]*\S/.test(p));
  const notLeft = withText.filter((p) => /<w:jc w:val="(center|both|right|distribute)"/.test(p)).length;

  let headerFooterText = false;
  for (const name of Object.keys(zip.files).filter((f) => /^word\/(header|footer)\d*\.xml$/.test(f))) {
    const xml = (await zip.file(name)?.async("string")) ?? "";
    if (/<w:t[^>]*>[^<]*\S/.test(xml)) headerFooterText = true;
  }

  const sect = /<w:sectPr[\s\S]*?<\/w:sectPr>/.exec(doc)?.[0] ?? "";
  const mar = sect.match(/<w:pgMar [^>]*>/)?.[0];
  const pg = sect.match(/<w:pgSz [^>]*>/)?.[0];
  const allText = (doc.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) ?? []).map((t) => t.replace(/<[^>]+>/g, "")).join(" ");

  return {
    images: (doc.match(/<w:drawing>|<w:pict>/g) ?? []).length,
    tables: (doc.match(/<w:tbl>/g) ?? []).length,
    columns: Math.max(1, ...[...doc.matchAll(/<w:cols [^>]*w:num="(\d+)"/g)].map((m) => Number(m[1]))),
    textBoxes: (doc.match(/<w:txbxContent>/g) ?? []).length,
    headerFooterText,
    fonts: [...fonts.entries()].filter(([, n]) => n / Math.max(1, chars) > 0.02).map(([f]) => f),
    avgFontPt: chars ? Math.round((sizeSum / chars) * 10) / 10 : baseSize,
    boldShare: chars ? bold / chars : 0,
    colourShare: chars ? coloured / chars : 0,
    notLeftShare: withText.length ? notLeft / withText.length : 0,
    margins: mar ? { top: Number(attr(mar, "top")), bottom: Number(attr(mar, "bottom")), left: Number(attr(mar, "left")), right: Number(attr(mar, "right")) } : null,
    page: pg ? { width: Number(attr(pg, "w")), height: Number(attr(pg, "h")) } : null,
    specialChars: (allText.match(/[☀-➿⬀-⯿\u{1F300}-\u{1FAFF}■-◿←-⇿]/gu) ?? []).length,
  };
}
