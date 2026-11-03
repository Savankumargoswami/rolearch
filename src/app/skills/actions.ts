"use server";

import { revalidatePath } from "next/cache";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { callAssess, isLevel, isSkill } from "@/lib/skill-tests";
import { createClient } from "@/lib/supabase/server";

export type StartResult = { ok: true; attemptId: string } | { ok: false; message: string };
export type SaveResult = { ok: boolean };

const EVENT_KINDS = new Set(["blur", "hidden", "fullscreen_exit", "paste", "copy", "contextmenu", "camera_off", "resize", "devtools"]);

function when(iso: string): string {
  return new Date(iso).toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short" });
}

/** Starts (or resumes) a test. The grading service generates the questions and keeps the answer key to itself. */
export async function startSkillTest(skill: string, level: string): Promise<StartResult> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false, message: t("profile.errSignedOut") };
  if (!isSkill(skill) || !isLevel(level)) return { ok: false, message: t("skills.errGeneric") };
  const res = await callAssess("/start", { user_id: viewer.id, skill, level });
  if (!res.ok) {
    if (res.error === "cooldown" && typeof res.data?.retry_at === "string") return { ok: false, message: t("skills.errCooldown", { when: when(res.data.retry_at) }) };
    if (res.error === "already passed") return { ok: false, message: t("skills.errPassed") };
    return { ok: false, message: res.error === "unavailable" ? t("skills.errUnavailable") : t("skills.errGeneric") };
  }
  revalidatePath("/skills");
  return { ok: true, attemptId: String(res.data.attempt_id) };
}

export async function saveSkillAnswer(attemptId: string, index: number, answer: string): Promise<SaveResult> {
  const db = await createClient();
  const { error } = await db.rpc("save_skill_answer", { p_attempt: attemptId, p_index: index, p_answer: answer.slice(0, 20000) });
  return { ok: !error };
}

export async function logSkillEvent(attemptId: string, kind: string, detail = ""): Promise<void> {
  if (!EVENT_KINDS.has(kind)) return;
  const db = await createClient();
  await db.rpc("log_skill_event", { p_attempt: attemptId, p_kind: kind, p_detail: detail.slice(0, 300) });
}

/** Stores one camera frame in the private proctor bucket under the member's own folder. */
export async function uploadSnapshot(attemptId: string, form: FormData): Promise<void> {
  const viewer = await loadViewer();
  const file = form.get("frame");
  if (!viewer || !(file instanceof Blob) || file.size > 250_000 || file.type !== "image/jpeg") return;
  const db = await createClient();
  const path = `${viewer.id}/${attemptId}/${Date.now()}.jpg`;
  const { error } = await db.storage.from("proctor").upload(path, file, { contentType: "image/jpeg", upsert: false });
  if (!error) await db.rpc("log_skill_event", { p_attempt: attemptId, p_kind: "snapshot", p_detail: path });
}

export async function submitSkillTest(attemptId: string): Promise<{ ok: boolean }> {
  const viewer = await loadViewer();
  if (!viewer) return { ok: false };
  const res = await callAssess("/submit", { user_id: viewer.id, attempt_id: attemptId });
  revalidatePath("/skills");
  revalidatePath(`/skills/result/${attemptId}`);
  return { ok: res.ok };
}
