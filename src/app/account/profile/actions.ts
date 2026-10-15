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

const PHOTO_MAX_BYTES = 2 * 1024 * 1024;
const PHOTO_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

export type PhotoResult = { ok: true; url: string } | { ok: false; message: string };

/** Uploads a profile photo to the public avatars bucket and removes the person's older photos. */
export async function uploadPhoto(form: FormData): Promise<PhotoResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: t("profile.errNoFile") };
  if (file.size > PHOTO_MAX_BYTES) return { ok: false, message: t("profile.errPhotoTooBig") };
  const ext = PHOTO_TYPES[file.type as keyof typeof PHOTO_TYPES];
  if (!ext) return { ok: false, message: t("profile.errPhotoType") };

  // A new file name each time, so browsers and the image cache never show the old photo.
  const path = `${user.id}/photo-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("avatars").upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type });
  if (error) return { ok: false, message: t("profile.errPhoto") };
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { error: saveError } = await supabase.from("profiles").update({ avatar_url: url, updated_at: new Date().toISOString() }).eq("id", user.id);
  if (saveError) return { ok: false, message: t("profile.errPhoto") };
  await removeOldPhotos(supabase, user.id, path);
  return { ok: true, url };
}

export async function removePhoto(): Promise<PhotoResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };
  const { error } = await supabase.from("profiles").update({ avatar_url: "", updated_at: new Date().toISOString() }).eq("id", user.id);
  if (error) return { ok: false, message: t("profile.errPhoto") };
  await removeOldPhotos(supabase, user.id);
  return { ok: true, url: "" };
}

async function removeOldPhotos(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from("avatars").list(userId);
  const old = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (old.length) await supabase.storage.from("avatars").remove(old);
}
