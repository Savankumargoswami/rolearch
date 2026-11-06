"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { AtsDocSchema, fit } from "@/lib/ats-doc";
import { loadViewer } from "@/lib/profile";
import { resumeDocx } from "@/lib/resume-docx";
import { resumePdf } from "@/lib/resume-pdf";
import { createClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; message: string };
type FileResult = { ok: true; filename: string; base64: string; type: string } | { ok: false; message: string };

export async function deleteVersion(id: string): Promise<Result> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const { error } = await db.from("resume_versions").delete().eq("id", String(id).slice(0, 40)).eq("user_id", viewer.id);
  if (error) return { ok: false, message: t("versions.errDelete") };
  revalidatePath("/account/resumes");
  return { ok: true };
}

const slug = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "_").replace(/^_|_$/g, "").slice(0, 40);

/** One saved version as a Word or PDF file. */
export async function downloadVersion(id: string, format: "pdf" | "docx", phone: string): Promise<FileResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  const db = await createClient();
  const { data } = await db.from("resume_versions").select("doc,company").eq("id", String(id).slice(0, 40)).eq("user_id", viewer.id).maybeSingle();
  if (!data) return { ok: false, message: t("versions.errMissing") };
  let doc;
  try {
    doc = fit(AtsDocSchema, data.doc);
  } catch {
    return { ok: false, message: t("versions.errMissing") };
  }
  const contact = { email: viewer.email, phone: String(phone ?? "").slice(0, 40) };
  const buf = format === "pdf" ? await resumePdf(doc, contact) : await resumeDocx(doc, contact);
  const name = `${slug(doc.full_name || "Resume")}${data.company ? `_${slug(data.company)}` : ""}_Resume.${format}`;
  return {
    ok: true,
    filename: name,
    base64: buf.toString("base64"),
    type: format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
}
