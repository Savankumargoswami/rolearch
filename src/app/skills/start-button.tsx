"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { t } from "@/i18n";
import { startSkillTest } from "./actions";

const MINUTES: Record<string, number> = { entry: 45, mid: 50, senior: 60, very_senior: 60 };

/** Opens a consent dialog (camera, full screen, recording), checks the camera works, then starts the test. */
export function StartButton({ skill, level, skillName, levelName, resume }: { skill: string; level: string; skillName: string; levelName: string; resume: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();

  const begin = () =>
    start(async () => {
      setError("");
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        stream.getTracks().forEach((tr) => tr.stop()); // only checking permission here; the test page opens the camera itself
      } catch {
        setError(t("skills.cameraNeeded"));
        return;
      }
      const res = await startSkillTest(skill, level);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      // Close the modal before leaving: the previous page stays mounted (hidden) after navigation, and an open modal
      // dialog would keep blocking every click and key press on the test page.
      dialog.current?.close();
      router.push(`/skills/test/${res.attemptId}`);
    });

  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (resume ? begin() : dialog.current?.showModal())}
        className="inline-flex min-h-11 items-center rounded-full bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-ink-hover disabled:opacity-60"
      >
        {resume ? t("skills.resume") : t("skills.start")}
      </button>
      {resume && error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <dialog ref={dialog} className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-3xl border border-line bg-surface p-6 text-ink backdrop:bg-ink/40">
        <h2 className="font-display text-2xl font-semibold">{t("skills.consentTitle")}</h2>
        <p className="mt-3 text-sm leading-relaxed text-muted">{t("skills.consentBody", { skill: skillName, level: levelName, minutes: MINUTES[level] })}</p>
        {error && (
          <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-800">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => dialog.current?.close()} className="min-h-11 rounded-full border border-line px-4 text-sm hover:bg-ink-soft">
            {t("skills.cancel")}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={begin}
            className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
          >
            {pending ? t("skills.starting") : t("skills.consentAgree")}
          </button>
        </div>
      </dialog>
    </>
  );
}
