"use server";

import { t } from "@/i18n";
import { ProfileSaveSchema, type ProfileData } from "@/lib/profile-schema";
import { readResume } from "@/lib/resume-reader";
import { createClient } from "@/lib/supabase/server";

const MAX_BYTES = 5 * 1024 * 1024;
const TYPES = {
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
} as const;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export type SaveResult = { ok: true } | { ok: false; message: string };

export async function saveProfile(input: ProfileData): Promise<SaveResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };
  const parsed = ProfileSaveSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: t("profile.errInvalid") };
  const p = parsed.data;
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: p.full_name,
      headline: p.headline,
      location: p.location,
      status: p.status,
      links: p.links,
      resume: p.resume,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  return error ? { ok: false, message: t("profile.errSave") } : { ok: true };
}

export type ReadState = { draft?: ProfileData; message?: string };

export async function readResumeAction(_: ReadState, form: FormData): Promise<ReadState> {
  const { supabase, user } = await currentUser();
  if (!user) return { message: t("profile.errSignedOut") };
  const file = form.get("resume");
  if (!(file instanceof File) || file.size === 0) return { message: t("profile.errNoFile") };
  if (file.size > MAX_BYTES) return { message: t("profile.errTooBig") };
  const kind = TYPES[file.type as keyof typeof TYPES];
  if (!kind) return { message: t("profile.errType") };

  const bytes = Buffer.from(await file.arrayBuffer());
  // Keep the original in the person's private folder (storage rules only allow their own user id).
  const path = `${user.id}/resume-${Date.now()}.${kind}`;
  const { error: uploadError } = await supabase.storage.from("resumes").upload(path, bytes, { contentType: file.type });
  if (!uploadError) await supabase.from("profiles").update({ resume_file: path }).eq("id", user.id);

  const result = await readResume({ bytes, kind });
  if ("error" in result) {
    const key = {
      unavailable: "profile.errReaderOff",
      refused: "profile.errUnreadable",
      unreadable: "profile.errUnreadable",
      too_long: "profile.errTooLong",
    } as const;
    return { message: t(key[result.error]) };
  }
  return { draft: result.draft };
}
