// Share links for ATS scores. The scores travel in the URL, signed so nobody can post a made-up "0 → 100" under
// Rolearch's name. Nothing about the person is in the link: just the scores and the job title.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

export type ShareCard = { before: number | null; after: number; title: string };

const key = () => createHmac("sha256", process.env.POST_REVIEW_SECRET ?? "dev").update("ats-share").digest();
const mac = (body: string) => createHmac("sha256", key()).update(body).digest("base64url").slice(0, 16);

export function signShare(card: ShareCard): string {
  const body = Buffer.from(JSON.stringify([card.before, card.after, card.title.slice(0, 80)])).toString("base64url");
  return `${body}.${mac(body)}`;
}

/** The card a share code stands for, or null if it was changed. */
export function readShare(code: string): ShareCard | null {
  const [body, sig] = decodeURIComponent(code).split(".");
  if (!body || !sig || sig.length !== 16) return null;
  const want = mac(body);
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const [before, after, title] = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    const ok = (v: unknown) => typeof v === "number" && v >= 0 && v <= 100;
    if (!ok(after) || (before !== null && !ok(before)) || typeof title !== "string") return null;
    return { before, after, title };
  } catch {
    return null;
  }
}
