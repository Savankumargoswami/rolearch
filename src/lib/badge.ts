// Public skill-badge pages (/badge/<code>), for members to add a passed skill test to LinkedIn as a certification.
// The code is the attempt id plus a signature, so only the member's own "Add to LinkedIn" link works; the page shows
// the skill, level, score and date, never who the person is.
import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { levelName, skillName } from "@/lib/skill-tests";
import { dataKey } from "@/lib/supabase/data-key";

const BASE = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const key = () => createHmac("sha256", process.env.POST_REVIEW_SECRET ?? "dev").update("skill-badge").digest();
const mac = (id: string) => createHmac("sha256", key()).update(id).digest("base64url").slice(0, 16);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type Badge = { id: string; skill: string; level: string; score: number; issued: string };

export const badgeCode = (attemptId: string) => `${attemptId}.${mac(attemptId)}`;

export function badgeId(code: string): string | null {
  const [id, sig] = decodeURIComponent(code).split(".");
  if (!id || !sig || !UUID.test(id) || sig.length !== 16) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(mac(id))) ? id : null;
}

/** A passed attempt's public details, or null. */
export async function loadBadge(code: string): Promise<Badge | null> {
  const id = badgeId(code);
  if (!id || !BASE || !dataKey) return null;
  try {
    const res = await fetch(`${BASE}/rest/v1/skill_attempts?select=skill,level,score,passed,submitted_at&id=eq.${id}`, { headers: { apikey: dataKey }, cache: "no-store" });
    if (!res.ok) return null;
    const [a] = (await res.json()) as { skill: string; level: string; score: number | null; passed: boolean | null; submitted_at: string | null }[];
    if (!a?.passed || !a.submitted_at) return null;
    return { id, skill: skillName(a.skill), level: levelName(a.level), score: Number(a.score ?? 0), issued: a.submitted_at };
  } catch {
    return null;
  }
}

export const badgeTitle = (b: Pick<Badge, "skill" | "level">) => `Rolearch Verified: ${b.skill} (${b.level})`;

/** LinkedIn's "Add licence or certification" form, pre-filled. */
export function linkedInAddUrl(b: Badge, pageUrl: string): string {
  const d = new Date(b.issued);
  const p = new URLSearchParams({
    startTask: "CERTIFICATION_NAME",
    name: badgeTitle(b),
    organizationName: "Rolearch",
    issueYear: String(d.getUTCFullYear()),
    issueMonth: String(d.getUTCMonth() + 1),
    certUrl: pageUrl,
    certId: b.id.slice(0, 8).toUpperCase(),
  });
  return `https://www.linkedin.com/profile/add?${p}`;
}
