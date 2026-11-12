"use client";

import { Camera, ChevronLeft, ChevronRight, Maximize } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/i18n";
import type { PublicQuestion } from "@/lib/skill-tests";
import { logSkillEvent, saveSkillAnswer, submitSkillTest, uploadSnapshot } from "../../actions";

type Props = { attemptId: string; title: string; deadline: string; questions: PublicQuestion[]; saved: Record<number, string> };
type SaveState = "idle" | "saving" | "saved" | "failed";

const SNAPSHOT_EVERY_MS = 50_000;

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function TestRunner({ attemptId, title, deadline, questions, saved }: Props) {
  const router = useRouter();
  const [answers, setAnswers] = useState<Record<number, string>>(() => {
    const a: Record<number, string> = { ...saved };
    questions.forEach((q, i) => {
      if (a[i] === undefined && q.kind === "code" && q.starter && q.lang !== "excel") a[i] = q.starter;
    });
    return a;
  });
  const [current, setCurrent] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [inFullscreen, setInFullscreen] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState<"" | "manual" | "timeout">("");
  const [notice, setNotice] = useState("");
  const [started, setStarted] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  const pending = useRef<Record<number, string>>({});
  const lastEvent = useRef<Record<string, number>>({});
  const done = useRef(false);
  const end = new Date(deadline).getTime();
  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled;

  const log = useCallback(
    (kind: string, detail = "") => {
      const at = Date.now();
      if (done.current || at - (lastEvent.current[kind] ?? 0) < 2000) return; // one of each kind per 2 s is enough
      lastEvent.current[kind] = at;
      void logSkillEvent(attemptId, kind, detail);
    },
    [attemptId],
  );

  const flush = useCallback(async () => {
    const entries = Object.entries(pending.current);
    pending.current = {};
    Object.values(timers.current).forEach(clearTimeout);
    await Promise.all(entries.map(([i, a]) => saveSkillAnswer(attemptId, Number(i), a).catch(() => ({ ok: false }))));
  }, [attemptId]);

  const submit = useCallback(
    async (why: "manual" | "timeout") => {
      if (done.current) return;
      done.current = true;
      setSubmitting(why);
      await flush();
      await submitSkillTest(attemptId);
      stream.current?.getTracks().forEach((tr) => tr.stop());
      if (document.fullscreenElement) await document.exitFullscreen().catch(() => {});
      router.replace(`/skills/result/${attemptId}`);
    },
    [attemptId, flush, router],
  );

  // Camera: on for the whole test, with a small preview; a frame is stored about once a minute.
  useEffect(() => {
    let alive = true;
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then((s) => {
        if (!alive) return s.getTracks().forEach((tr) => tr.stop());
        stream.current = s;
        if (video.current) video.current.srcObject = s;
        s.getVideoTracks()[0]?.addEventListener("ended", () => log("camera_off"));
      })
      .catch(() => {
        setCameraError(true);
        log("camera_off", "permission");
      });
    const snap = () => {
      const v = video.current;
      if (!v || !v.videoWidth || done.current) return;
      const c = document.createElement("canvas");
      c.width = 320;
      c.height = Math.round((320 * v.videoHeight) / v.videoWidth);
      c.getContext("2d")?.drawImage(v, 0, 0, c.width, c.height);
      c.toBlob(
        (blob) => {
          if (!blob) return;
          const form = new FormData();
          form.append("frame", blob, "frame.jpg");
          void uploadSnapshot(attemptId, form);
        },
        "image/jpeg",
        0.6,
      );
    };
    const first = setTimeout(snap, 5000);
    const every = setInterval(snap, SNAPSHOT_EVERY_MS);
    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(every);
      stream.current?.getTracks().forEach((tr) => tr.stop());
    };
  }, [attemptId, log]);

  // Proctoring signals.
  useEffect(() => {
    const onVis = () => document.visibilityState === "hidden" && log("hidden");
    const onBlur = () => log("blur");
    const onFs = () => {
      const on = Boolean(document.fullscreenElement);
      setInFullscreen(on);
      if (!on && !done.current) log("fullscreen_exit");
    };
    const block = (kind: "copy" | "paste" | "contextmenu") => (e: Event) => {
      e.preventDefault();
      log(kind);
      if (kind === "paste") setNotice(t("skills.noPaste"));
    };
    const onCopy = block("copy");
    const onPaste = block("paste");
    const onMenu = block("contextmenu");
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (e.key === "F12" || ((e.ctrlKey || e.metaKey) && e.shiftKey && ["i", "j", "c"].includes(k))) {
        e.preventDefault();
        log("devtools");
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (!done.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("blur", onBlur);
    document.addEventListener("fullscreenchange", onFs);
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCopy);
    document.addEventListener("paste", onPaste);
    document.addEventListener("contextmenu", onMenu);
    document.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("fullscreenchange", onFs);
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCopy);
      document.removeEventListener("paste", onPaste);
      document.removeEventListener("contextmenu", onMenu);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [log]);

  // Clock; submit automatically when time runs out.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (now >= end && !done.current) void submit("timeout");
  }, [now, end, submit]);

  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3000);
    return () => clearTimeout(id);
  }, [notice]);

  /** Saves one answer; on a network or server failure it stays pending, shows "Not saved", and is retried. */
  const save = useCallback(
    async (i: number) => {
      const v = pending.current[i];
      if (v === undefined) return;
      delete pending.current[i];
      let ok = false;
      try {
        ok = (await saveSkillAnswer(attemptId, i, v)).ok;
      } catch {
        ok = false;
      }
      if (!ok && pending.current[i] === undefined) pending.current[i] = v; // keep it for the retry unless a newer value arrived
      setSaveState(ok ? (Object.keys(pending.current).length ? "saving" : "saved") : "failed");
    },
    [attemptId],
  );

  // Answers that failed to save are retried when the connection comes back, and every 10 s while any are waiting.
  useEffect(() => {
    const retry = () => Object.keys(pending.current).forEach((k) => void save(Number(k)));
    window.addEventListener("online", retry);
    const id = setInterval(() => {
      if (Object.keys(pending.current).length) retry();
    }, 10_000);
    return () => {
      window.removeEventListener("online", retry);
      clearInterval(id);
    };
  }, [save]);

  const change = (i: number, value: string) => {
    setAnswers((a) => ({ ...a, [i]: value }));
    pending.current[i] = value;
    clearTimeout(timers.current[i]);
    setSaveState("saving");
    timers.current[i] = setTimeout(() => void save(i), 700);
  };

  const enterFullscreen = async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      log("fullscreen_exit", "refused");
    }
  };

  const ready = !cameraError && (inFullscreen || !fullscreenSupported);
  if (ready && !started) setStarted(true); // adjusting state during render: React re-renders right away
  const q = questions[current];
  const answered = (i: number) => {
    const a = answers[i];
    return a !== undefined && a.trim() !== "" && a !== questions[i].starter;
  };

  if (submitting) {
    return (
      <div className="mx-auto grid min-h-[60vh] max-w-xl place-items-center px-4 text-center">
        <p className="font-display text-2xl font-semibold" role="status">
          {submitting === "timeout" ? t("skills.timeUp") : t("skills.submitting")}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper select-none">
      {/* top-16: sits below the site's sticky header (h-16), so the timer stays visible while scrolling */}
      <div className="sticky top-16 z-20 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <p className="font-display text-lg font-semibold">{title}</p>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted" aria-live="polite">
              {saveState === "saving" ? t("skills.saving") : saveState === "saved" ? t("skills.saved") : saveState === "failed" ? t("skills.saveFailed") : ""}
            </span>
            <span className={`rounded-full px-3 py-1 font-mono tabular-nums ${end - now < 5 * 60_000 ? "bg-red-50 text-red-800" : "bg-ink-soft"}`}>
              {t("skills.timeLeft")} {clock(end - now)}
            </span>
          </div>
        </div>
      </div>

      {!ready ? (
        <div className="mx-auto max-w-xl px-4 py-16 text-center">
          {cameraError ? (
            <p role="alert" className="rounded-2xl bg-red-50 p-5 text-red-800">
              {t("skills.cameraNeeded")}
            </p>
          ) : (
            <>
              <h1 className="font-display text-2xl font-semibold">{started ? t("skills.backToFullscreen") : t("skills.gateTitle")}</h1>
              <p role={started ? "alert" : undefined} className="mt-2 text-muted">
                {started ? t("skills.leftFullscreen") : t("skills.gateBody")}
              </p>
              <button
                type="button"
                onClick={enterFullscreen}
                className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover"
              >
                <Maximize aria-hidden="true" className="size-4" />
                {started ? t("skills.backToFullscreen") : t("skills.enterFullscreen")}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_15rem]">
          <section aria-label={title}>
            <p className="text-sm text-muted">
              {t("skills.question", { n: current + 1, total: questions.length })}
              {q.kind === "code" || q.kind === "numeric" ? ` · ${t("skills.task")}` : ""} · {q.topic}
            </p>
            <QuestionView q={q} index={current} total={questions.length} value={answers[current] ?? ""} onChange={change} />
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                disabled={current === 0}
                onClick={() => setCurrent((c) => c - 1)}
                className="inline-flex min-h-11 items-center gap-1 rounded-full border border-line px-4 text-sm hover:bg-ink-soft disabled:opacity-40"
              >
                <ChevronLeft aria-hidden="true" className="size-4" />
                {t("skills.prev")}
              </button>
              {current < questions.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setCurrent((c) => c + 1)}
                  className="inline-flex min-h-11 items-center gap-1 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover"
                >
                  {t("skills.next")}
                  <ChevronRight aria-hidden="true" className="size-4" />
                </button>
              ) : (
                <button type="button" onClick={() => setConfirming(true)} className="min-h-11 rounded-full bg-ink px-5 text-sm font-medium text-paper hover:bg-ink-hover">
                  {t("skills.submit")}
                </button>
              )}
            </div>
          </section>
          <aside className="order-first lg:order-none">
            <ol className="grid grid-cols-7 gap-1.5 lg:grid-cols-4">
              {questions.map((qq, i) => (
                <li key={i}>
                  <button
                    type="button"
                    onClick={() => setCurrent(i)}
                    aria-current={i === current ? "step" : undefined}
                    aria-label={`${t("skills.question", { n: i + 1, total: questions.length })}${answered(i) ? ", answered" : ""}`}
                    className={`grid size-10 place-items-center rounded-xl border text-sm tabular-nums ${
                      i === current ? "border-ink bg-ink text-paper" : answered(i) ? "border-ink/40 bg-ink-soft" : "border-line bg-surface"
                    } ${qq.kind === "code" || qq.kind === "numeric" ? "font-semibold" : ""}`}
                  >
                    {i + 1}
                  </button>
                </li>
              ))}
            </ol>
            <button type="button" onClick={() => setConfirming(true)} className="mt-4 hidden min-h-11 w-full rounded-full border border-line text-sm hover:bg-ink-soft lg:block">
              {t("skills.submit")}
            </button>
          </aside>
        </div>
      )}

      {confirming && (
        <div role="dialog" aria-modal="true" aria-labelledby="confirm-h" className="fixed inset-0 z-40 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-surface p-6">
            <p id="confirm-h" className="font-medium">
              {t("skills.submitConfirm")}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} className="min-h-11 rounded-full border border-line px-4 text-sm hover:bg-ink-soft">
                {t("skills.cancel")}
              </button>
              <button type="button" onClick={() => void submit("manual")} className="min-h-11 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-ink-hover">
                {t("skills.submit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {notice && (
        <p role="status" className="fixed bottom-24 left-1/2 z-30 -translate-x-1/2 rounded-full bg-ink px-4 py-2 text-sm text-paper">
          {notice}
        </p>
      )}

      <div className="fixed bottom-4 right-4 z-30 overflow-hidden rounded-2xl border border-line bg-ink shadow-lg">
        <video ref={video} autoPlay muted playsInline className="h-20 w-28 object-cover" aria-label="Your camera" />
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-ink/70 px-1.5 py-0.5 text-[0.7rem] text-paper">
          <Camera aria-hidden="true" className="size-3" /> REC
        </span>
      </div>
    </div>
  );
}

function QuestionView({ q, index, total, value, onChange }: { q: PublicQuestion; index: number; total: number; value: string; onChange: (i: number, v: string) => void }) {
  if (q.kind === "output" || q.kind === "mcq") {
    return (
      <fieldset className="mt-3">
        <legend className="sr-only">{t("skills.question", { n: index + 1, total })}</legend>
        <pre className="overflow-x-auto whitespace-pre-wrap rounded-2xl border border-line bg-surface p-4 font-mono text-[0.85rem] leading-relaxed">{q.text}</pre>
        <div className="mt-4 grid gap-2">
          {(q.options ?? []).map((opt, k) => (
            <label
              key={k}
              className={`flex cursor-pointer gap-3 rounded-2xl border p-3 ${value === String(k) ? "border-ink bg-ink-soft" : "border-line bg-surface hover:bg-ink-soft/50"}`}
            >
              <input type="radio" name={`q${index}`} className="mt-1" checked={value === String(k)} onChange={() => onChange(index, String(k))} />
              <span className="font-mono text-[0.85rem] font-semibold">{String.fromCharCode(65 + k)}</span>
              <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap font-mono text-[0.85rem]">{opt}</pre>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (q.kind === "numeric") {
    return (
      <div className="mt-3">
        <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface p-4 leading-relaxed">{q.text}</p>
        <input
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(index, e.target.value)}
          placeholder={t("skills.numberPlaceholder")}
          aria-label={t("skills.numberPlaceholder")}
          className="mt-4 min-h-11 w-full max-w-xs rounded-xl border border-line bg-surface px-3 font-mono"
        />
      </div>
    );
  }
  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== "Tab") return;
    e.preventDefault();
    const el = e.currentTarget;
    const { selectionStart: s, selectionEnd: en } = el;
    const next = value.slice(0, s) + "  " + value.slice(en);
    onChange(index, next);
    requestAnimationFrame(() => el.setSelectionRange(s + 2, s + 2));
  };
  return (
    <div className="mt-3">
      <p className="whitespace-pre-wrap rounded-2xl border border-line bg-surface p-4 leading-relaxed">{q.text}</p>
      {q.schema && (
        <div className="mt-3">
          <p className="text-sm font-medium">{t("skills.schema")}</p>
          <pre className="mt-1 overflow-x-auto rounded-xl bg-ink-soft p-3 font-mono text-[0.8rem]">{q.schema}</pre>
        </div>
      )}
      {q.sample && <SampleSheet sample={q.sample} />}
      {q.lang === "excel" && q.sample && <p className="mt-3 text-sm text-muted">{t("skills.formulaFor", { cell: `${q.sample.out_col}${q.sample.first_row}` })}</p>}
      <textarea
        value={value}
        onChange={(e) => onChange(index, e.target.value)}
        onKeyDown={onKey}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        rows={q.lang === "excel" ? 2 : 18}
        aria-label="Your answer"
        placeholder={q.lang === "excel" ? "=..." : ""}
        className="mt-3 w-full resize-y rounded-2xl border border-line bg-[#0e1f2f] p-4 font-mono text-[0.85rem] leading-relaxed text-[#f4f5f1] caret-[#e0a35b] select-text"
      />
    </div>
  );
}

function SampleSheet({ sample }: { sample: NonNullable<PublicQuestion["sample"]> }) {
  const keys = Object.keys(sample.cells);
  const colOf = (k: string) => k.match(/^[A-Z]+/)![0];
  const rowOf = (k: string) => Number(k.match(/\d+$/)![0]);
  const toNum = (c: string) => [...c].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
  const cols = [...new Set([...keys.map(colOf), sample.out_col])].sort((a, b) => toNum(a) - toNum(b));
  const rows = [...new Set(keys.map(rowOf))].sort((a, b) => a - b);
  const show = (v: unknown) => (v === null || v === undefined ? "" : typeof v === "number" ? String(v) : String(v));
  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{t("skills.sample")}</p>
      <div className="mt-1 max-h-72 overflow-auto rounded-xl border border-line">
        <table className="min-w-full border-collapse font-mono text-[0.78rem]">
          <thead>
            <tr>
              <th className="sticky top-0 bg-ink-soft px-2 py-1" />
              {cols.map((c) => (
                <th key={c} className={`sticky top-0 bg-ink-soft px-2 py-1 ${c === sample.out_col ? "text-signal-ink" : ""}`}>
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r} className="border-t border-line">
                <th className="bg-ink-soft px-2 py-1 text-right">{r}</th>
                {cols.map((c) => (
                  <td key={c} className={`whitespace-nowrap px-2 py-1 ${c === sample.out_col && r >= sample.first_row ? "bg-[#e0a35b]/15" : ""}`}>
                    {show(sample.cells[`${c}${r}`])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
