"use server";

import { t } from "@/i18n";
import { reviewPost, type ReviewImage } from "@/lib/post-review";
import { createClient } from "@/lib/supabase/server";

const MAX_IMAGES = 4;
const IMAGE_MAX_BYTES = 2 * 1024 * 1024;
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

async function currentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}

export type PostResult = { ok: true } | { ok: false; rejected?: boolean; message: string };

/** Reviews a post, and only if it fits the rules uploads its images and publishes it. */
export async function createPost(form: FormData): Promise<PostResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };

  const body = String(form.get("body") ?? "").trim();
  const link = String(form.get("link") ?? "").trim();
  if (body.length < 10) return { ok: false, message: t("posts.errShort") };
  if (body.length > 2000) return { ok: false, message: t("posts.errLong") };
  if (link && (link.length > 500 || !/^https?:\/\/[^\s]+\.[^\s]+$/i.test(link))) return { ok: false, message: t("posts.errLink") };

  const files = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length > MAX_IMAGES) return { ok: false, message: t("posts.errTooMany") };
  const images: (ReviewImage & { ext: string })[] = [];
  for (const f of files) {
    const ext = IMAGE_TYPES[f.type as keyof typeof IMAGE_TYPES];
    if (!ext) return { ok: false, message: t("profile.errPhotoType") };
    if (f.size > IMAGE_MAX_BYTES) return { ok: false, message: t("posts.errImageBig") };
    images.push({ bytes: Buffer.from(await f.arrayBuffer()), type: f.type as ReviewImage["type"], ext });
  }

  const review = await reviewPost({ body, link, images });
  if ("error" in review) return { ok: false, message: review.error === "unavailable" ? t("posts.errOff") : t("posts.errReview") };
  if (!review.allowed) return { ok: false, rejected: true, message: review.reason };

  // Approved: store the images in the member's own folder, then publish.
  const stamp = Date.now();
  const paths: string[] = [];
  for (const [i, img] of images.entries()) {
    const path = `${user.id}/${stamp}-${i}.${img.ext}`;
    const { error } = await supabase.storage.from("post-images").upload(path, img.bytes, { contentType: img.type });
    if (error) {
      if (paths.length) await supabase.storage.from("post-images").remove(paths);
      return { ok: false, message: t("posts.errSave") };
    }
    paths.push(path);
  }
  const { error } = await supabase.rpc("publish_post", {
    p_secret: process.env.POST_REVIEW_SECRET,
    p_kind: review.kind,
    p_body: body,
    p_link: link,
    p_images: paths,
    p_review: { reason: review.reason, model: "claude-haiku-5-5", at: new Date().toISOString() },
  });
  if (error) {
    console.error("[posts] publish failed:", error.message);
    if (paths.length) await supabase.storage.from("post-images").remove(paths);
    return { ok: false, message: t("posts.errSave") };
  }
  return { ok: true };
}

export async function deletePost(id: string): Promise<PostResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };
  const { data } = await supabase.from("posts").select("images").eq("id", id).eq("author_id", user.id).maybeSingle();
  if (!data) return { ok: false, message: t("posts.errSave") };
  const { error } = await supabase.from("posts").delete().eq("id", id).eq("author_id", user.id);
  if (error) return { ok: false, message: t("posts.errSave") };
  const images = (data.images as string[] | null) ?? [];
  if (images.length) await supabase.storage.from("post-images").remove(images);
  return { ok: true };
}

export async function setFollow(profileId: string, follow: boolean): Promise<PostResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };
  if (profileId === user.id) return { ok: false, message: t("posts.errSave") };
  const { error } = follow
    ? await supabase.from("follows").upsert({ follower_id: user.id, following_id: profileId }, { ignoreDuplicates: true })
    : await supabase.from("follows").delete().eq("follower_id", user.id).eq("following_id", profileId);
  return error ? { ok: false, message: t("posts.errFollow") } : { ok: true };
}
