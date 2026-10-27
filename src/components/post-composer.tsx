"use client";

import { ImagePlus, Link2, ShieldCheck, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, useTransition } from "react";
import { createPost } from "@/app/posts/actions";
import { t } from "@/i18n";

const MAX_IMAGES = 4;
const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = ["image/jpeg", "image/png", "image/webp"];

type Picked = { file: File; url: string };

/** Write a post. Claude checks it on the server; only projects, outputs and resources get published. */
/** company: worded for an employer's hiring posts instead of a member's work. */
export function PostComposer({ enabled, company = false }: { enabled: boolean; company?: boolean }) {
  const router = useRouter();
  const id = useId();
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [showLink, setShowLink] = useState(false);
  const [images, setImages] = useState<Picked[]>([]);
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "rejected"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function pick(files: FileList | null) {
    if (!files) return;
    const room = MAX_IMAGES - images.length;
    const ok: Picked[] = [];
    for (const file of Array.from(files)) {
      if (!TYPES.includes(file.type)) return setStatus({ kind: "error", text: t("profile.errPhotoType") });
      if (file.size > MAX_BYTES) return setStatus({ kind: "error", text: t("posts.errImageBig") });
      if (ok.length < room) ok.push({ file, url: URL.createObjectURL(file) });
    }
    setStatus(files.length > room ? { kind: "error", text: t("posts.errTooMany") } : null);
    setImages((list) => [...list, ...ok]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function drop(i: number) {
    URL.revokeObjectURL(images[i].url);
    setImages((list) => list.filter((_, j) => j !== i));
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const data = new FormData();
    data.set("body", body);
    data.set("link", link);
    for (const img of images) data.append("images", img.file);
    setStatus(null);
    start(async () => {
      const res = await createPost(data);
      if (res.ok) {
        images.forEach((img) => URL.revokeObjectURL(img.url));
        setBody("");
        setLink("");
        setShowLink(false);
        setImages([]);
        setStatus({ kind: "ok", text: t("posts.published") });
        router.refresh();
      } else setStatus({ kind: res.rejected ? "rejected" : "error", text: res.message });
    });
  }

  const left = 2000 - body.length;

  return (
    <form onSubmit={submit} className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
      <label htmlFor={`${id}-body`} className="font-display text-lg font-semibold">
        {t(company ? "posts.composeTitleCompany" : "posts.composeTitle")}
      </label>
      <p id={`${id}-rule`} className="mt-1 flex items-start gap-2 text-sm text-muted">
        <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal-ink" />
        {t(company ? "posts.ruleCompany" : "posts.rule")}
      </p>
      <textarea
        id={`${id}-body`}
        aria-describedby={`${id}-rule`}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        maxLength={2000}
        rows={4}
        disabled={!enabled}
        placeholder={t(company ? "posts.placeholderCompany" : "posts.placeholder")}
        className="mt-3 w-full resize-y rounded-xl border border-line bg-paper/40 px-4 py-3 leading-relaxed outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)] disabled:cursor-not-allowed"
      />

      {showLink && (
        <div className="mt-2">
          <label htmlFor={`${id}-link`} className="sr-only">
            {t("posts.linkLabel")}
          </label>
          <input
            id={`${id}-link`}
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://github.com/…"
            className="h-11 w-full rounded-xl border border-line bg-surface px-4 outline-none focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]"
          />
        </div>
      )}

      {images.length > 0 && (
        <ul className="mt-3 grid grid-cols-4 gap-2">
          {images.map((img, i) => (
            <li key={img.url} className="relative aspect-square overflow-hidden rounded-xl border border-line bg-ink-soft">
              {/* Local preview of a picked file (blob URL), which next/image can't optimise. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.url} alt="" className="size-full object-cover" />
              <button
                type="button"
                onClick={() => drop(i)}
                aria-label={t("posts.removeImage")}
                className="absolute end-1 top-1 grid size-8 cursor-pointer place-items-center rounded-full bg-ink/80 text-paper hover:bg-ink"
              >
                <X aria-hidden="true" className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label
          className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-[0.95rem] hover:bg-ink-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink ${
            images.length >= MAX_IMAGES || !enabled ? "pointer-events-none opacity-50" : ""
          }`}
        >
          <ImagePlus aria-hidden="true" className="size-5" />
          {t("posts.addImages")}
          <input ref={fileRef} type="file" multiple accept={TYPES.join(",")} onChange={(e) => pick(e.target.files)} className="sr-only" disabled={!enabled} />
        </label>
        <button
          type="button"
          onClick={() => setShowLink((v) => !v)}
          aria-expanded={showLink}
          disabled={!enabled}
          className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full px-3 text-[0.95rem] hover:bg-ink-soft disabled:opacity-50"
        >
          <Link2 aria-hidden="true" className="size-5" />
          {t("posts.addLink")}
        </button>
        <span className={`ms-auto text-sm tabular-nums ${left < 100 ? "text-signal-ink" : "text-muted"}`}>{left}</span>
        <button
          type="submit"
          disabled={pending || !enabled || body.trim().length < 10}
          className="min-h-11 cursor-pointer rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? t("posts.checking") : t("posts.post")}
        </button>
      </div>

      {!enabled && <p className="mt-2 text-sm text-muted">{t("posts.errOff")}</p>}
      {status && (
        <p
          role={status.kind === "ok" ? "status" : "alert"}
          className={`mt-3 rounded-xl px-4 py-3 text-[0.95rem] ${
            status.kind === "ok" ? "bg-ink-soft" : status.kind === "rejected" ? "border border-signal/60 bg-signal/10" : "font-medium text-signal-ink"
          }`}
        >
          {status.kind === "rejected" && <strong className="block">{t("posts.rejectedTitle")}</strong>}
          {status.text}
        </p>
      )}
    </form>
  );
}
