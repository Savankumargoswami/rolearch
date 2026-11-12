/**
 * Whether uploaded bytes really are the kind the browser claimed (the type it sends is only a claim):
 * a PDF starts with "%PDF-" (allowed within the first 1 KB, as PDF readers do); a .docx is a ZIP that holds word/ parts.
 */
export function looksLikeDocument(bytes: Buffer, kind: "pdf" | "docx"): boolean {
  if (kind === "pdf") return bytes.subarray(0, 1024).includes("%PDF-");
  return bytes.length > 4 && bytes.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) && bytes.includes("word/");
}
