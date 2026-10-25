"use server";

import { t } from "@/i18n";
import { reviewPost, type ReviewImage } from "@/lib/post-review";
import { createClient, supabaseKey, supabaseUrl } from "@/lib/supabase/server";

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
    p_review: { reason: review.reason, model: "claude-haiku-5-5", at: new Date().toISOString(), ...(review.hiring ? { hiring: review.hiring } : {}) },
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

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Says (or takes back) that the signed-in member is interested in a hiring post; the author gets an email. */
export async function setInterest(postId: string, interested: boolean): Promise<PostResult> {
  const { supabase, user } = await currentUser();
  if (!user) return { ok: false, message: t("profile.errSignedOut") };
  if (!/^[0-9a-f-]{36}$/i.test(postId)) return { ok: false, message: t("posts.errSave") };
  if (!interested) {
    await supabase.from("post_interest").delete().eq("post_id", postId).eq("user_id", user.id);
    return { ok: true };
  }
  const { error } = await supabase.from("post_interest").insert({ post_id: postId, user_id: user.id });
  // Already interested (primary key) is fine; anything else (own post, not a hiring post) is refused by the policy.
  if (error && error.code !== "23505") {
    console.error("[posts] interest failed:", error.message);
    return { ok: false, message: t("posts.errSave") };
  }
  if (!error) await tellAuthor(postId, user.id);
  return { ok: true };
}

async function tellAuthor(postId: string, memberId: string) {
  const resendKey = process.env.RESEND_API_KEY;
  const secret = process.env.POST_REVIEW_SECRET;
  if (!resendKey || !secret || !supabaseUrl || !supabaseKey) return;
  try {
    const supabase = await createClient();
    const [{ data: email }, { data: post }, { data: me }] = await Promise.all([
      supabase.rpc("post_author_email", { p_secret: secret, p_post: postId }),
      supabase.from("posts").select("body, review").eq("id", postId).maybeSingle(),
      supabase.from("profiles").select("full_name, headline").eq("id", memberId).maybeSingle(),
    ]);
    if (typeof email !== "string" || !email) return;
    const role = (post?.review as { hiring?: { role?: string } } | null)?.hiring?.role || "your role";
    const name = me?.full_name || "A Rolearch member";
    const profile = `https://www.rolearch.com/u/${memberId}`;
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${resendKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Rolearch <noreply@rolearch.com>",
        to: [email],
        subject: `${name} is interested in your ${role} opening`,
        html: `<div style="font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#111;max-width:560px">
<p style="font-size:17px"><strong>${esc(name)}</strong>${me?.headline ? ` (${esc(me.headline)})` : ""} is interested in the <strong>${esc(role)}</strong> role you posted on Rolearch.</p>
<p><a href="${profile}" style="display:inline-block;background:#1B2A3A;color:#fff;padding:10px 16px;border-radius:999px;text-decoration:none;font-weight:600">See their profile</a></p>
<p style="color:#555;font-size:13px">Your post: “${esc(String(post?.body ?? "").slice(0, 200))}”</p>
<p style="color:#888;font-size:12px">You get this because you posted a hiring post on Rolearch. Everyone who's interested is listed under your post.</p></div>`,
      }),
    });
  } catch (e) {
    console.error("[posts] interest email failed:", e instanceof Error ? e.message : e);
  }
}
