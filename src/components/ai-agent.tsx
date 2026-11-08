"use client";

import { Check, ChevronDown, Sparkles } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { t, type MessageKey } from "@/i18n";

// Rolearch AI at work: a floating dock that follows the long ATS tasks (scan, tailoring, recruiter review, cover
// letter) step by step while they run, then reports how long they took. Steps advance on the task's typical pace and
// the last one holds until the server answers, so the dock never claims to be done before it is.

export type AgentKind = "scan" | "tailor" | "review" | "letter";
const STEPS: Record<AgentKind, number> = { scan: 5, tailor: 5, review: 4, letter: 3 };
// Typical seconds per task, for pacing the steps.
const PACE: Record<AgentKind, number> = { scan: 14, tailor: 45, review: 25, letter: 15 };

type Task = { kind: AgentKind; started: number; done: number | null };
let task: Task | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};
const snapshot = () => task;

/** Shows the agent working on `kind` while `active` is true. */
export function useAgentTask(kind: AgentKind, active: boolean) {
  useEffect(() => {
    if (!active) return;
    task = { kind, started: Date.now(), done: null };
    emit();
    return () => {
      if (task && task.kind === kind && task.done === null) {
        task = { ...task, done: Date.now() };
        emit();
      }
    };
  }, [kind, active]);
}

/** The live status line in the ATS panel header: "Ready" or what the agent is doing. */
export function AgentStatus() {
  const current = useSyncExternalStore(subscribe, snapshot, () => null);
  const working = Boolean(current && current.done === null);
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-ink-soft px-2.5 py-1 text-xs font-medium" aria-live="polite">
      <span className={`size-2 rounded-full ${working ? "agent-pulse bg-signal" : "bg-[#1f7a4d]"}`} aria-hidden="true" />
      {working && current ? t(`agent.title_${current.kind}` as MessageKey) : t("agent.ready")}
    </span>
  );
}

/** The floating dock. Mount once next to the ATS panel. */
export function AgentDock() {
  const current = useSyncExternalStore(subscribe, snapshot, () => null);
  const [open, setOpen] = useState(true);
  const running = Boolean(current && current.done === null);
  // A clock that ticks while working and for a few seconds after, so a finished task shows briefly, then tucks away.
  const [now, setNow] = useState(0);
  const live = Boolean(current) && (current!.done === null || now - current!.done < 3600);
  useEffect(() => {
    if (!live) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [live]);

  if (!current || (current.done !== null && now - current.done > 3500)) return null;
  const steps = STEPS[current.kind];
  const elapsed = Math.max(0, ((current.done ?? now) - current.started) / 1000);
  // Ease through the steps on the task's usual pace; the last step holds until the answer arrives.
  const reached = current.done ? steps : Math.min(steps - 1, Math.floor((1 - Math.exp(-elapsed / (PACE[current.kind] / 2))) * steps));
  const progress = current.done ? 100 : Math.min(94, (1 - Math.exp(-elapsed / (PACE[current.kind] / 1.6))) * 100);

  return (
    <aside
      aria-label={t("agent.label")}
      className="agent-in fixed end-4 bottom-4 z-40 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-3xl text-paper glass-ink"
    >
      <div className="flex items-center gap-3 px-4 pt-4">
        <span className={`relative grid size-9 shrink-0 place-items-center rounded-full bg-signal/20 ${running ? "agent-orb" : ""}`} aria-hidden="true">
          {running ? <Sparkles className="size-4 text-signal" /> : <Check className="size-4 text-signal" strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold tracking-[0.12em] text-[#c9d2de] uppercase">{t("agent.name")}</p>
          <p className="truncate font-display font-semibold">
            {running ? t(`agent.title_${current.kind}` as MessageKey) : t("agent.done", { s: Math.max(1, Math.round(elapsed)) })}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? t("agent.collapse") : t("agent.expand")}
          className="grid size-10 shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-white/10"
        >
          <ChevronDown aria-hidden="true" className={`size-4 transition-transform duration-200 ${open ? "" : "rotate-180"}`} />
        </button>
      </div>
      <div className="mx-4 mt-3 h-1 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <div className="h-full rounded-full bg-signal transition-[width] duration-300 ease-out" style={{ width: `${progress}%` }} />
      </div>
      {open && (
        <ol className="flex flex-col gap-2 px-4 pt-3 pb-4 text-sm">
          {Array.from({ length: steps }, (_, i) => {
            const state = i < reached ? "done" : i === reached && running ? "now" : "later";
            return (
              <li key={i} className={`flex items-center gap-2.5 transition-opacity duration-300 ${state === "later" ? "opacity-45" : ""}`}>
                <span className="grid size-5 shrink-0 place-items-center" aria-hidden="true">
                  {state === "done" ? (
                    <Check className="size-4 text-signal" strokeWidth={3} />
                  ) : state === "now" ? (
                    <span className="agent-spin size-3.5 rounded-full border-2 border-signal border-t-transparent" />
                  ) : (
                    <span className="size-1.5 rounded-full bg-[#c9d2de]" />
                  )}
                </span>
                <span className={state === "now" ? "font-medium" : "text-[#dfe5ec]"}>{t(`agent.${current.kind}_${i}` as MessageKey)}</span>
              </li>
            );
          })}
          <li className="mt-1 text-xs text-[#9fb0c3] tabular-nums">{t("agent.elapsed", { s: Math.round(elapsed) })}</li>
        </ol>
      )}
    </aside>
  );
}
