"use client";

import { CircleCheck, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import { t } from "@/i18n";
import { FEATURES } from "@/lib/feedback";
import { sendFeedback } from "./actions";

const box =
  "w-full resize-y rounded-xl border border-line bg-surface px-4 py-3 leading-relaxed outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]";

/** Likes, dislikes, wishes and an overall rating. Every part is optional, but something must be filled in. */
export function FeedbackForm({ company }: { company: boolean }) {
  const id = useId();
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [likedNote, setLikedNote] = useState("");
  const [dislikedNote, setDislikedNote] = useState("");
  const [wishlist, setWishlist] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  const features = FEATURES.filter((f) => company || f.id !== "hiring");

  if (done) {
    return (
      <div role="status" className="mt-8 rounded-2xl border border-line bg-signal/20 p-6">
        <p className="flex items-center gap-2 font-display text-xl font-semibold">
          <CircleCheck aria-hidden="true" className="size-6" />
          {t("feedback.thanks")}
        </p>
        <p className="mt-2 text-muted">{t("feedback.thanksBody")}</p>
        <Link href="/" className="mt-4 inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
          {t("feedback.backHome")}
        </Link>
      </div>
    );
  }

  const toggle = (list: string[], set: (v: string[]) => void, other: string[], setOther: (v: string[]) => void, f: string) => {
    if (list.includes(f)) set(list.filter((x) => x !== f));
    else {
      set([...list, f]);
      if (other.includes(f)) setOther(other.filter((x) => x !== f)); // a feature can't be both liked and disliked
    }
  };

  const chips = (selected: string[], onToggle: (f: string) => void, tone: "up" | "down") => (
    <ul className="mt-3 flex flex-wrap gap-2">
      {features.map((f) => {
        const on = selected.includes(f.id);
        return (
          <li key={f.id}>
            <button
              type="button"
              aria-pressed={on}
              onClick={() => onToggle(f.id)}
              className={`inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 text-[0.95rem] transition-colors duration-200 ${
                on ? (tone === "up" ? "border-ink bg-ink text-paper" : "border-[#b4532a] bg-[#b4532a] text-paper") : "border-line hover:border-ink"
              }`}
            >
              {on && (tone === "up" ? <ThumbsUp aria-hidden="true" className="size-4" /> : <ThumbsDown aria-hidden="true" className="size-4" />)}
              {f.label}
            </button>
          </li>
        );
      })}
    </ul>
  );

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        start(async () => {
          const res = await sendFeedback({ liked, disliked, likedNote, dislikedNote, wishlist, rating });
          if (res.ok) setDone(true);
          else setError(res.message ?? t("feedback.errSave"));
        });
      }}
      className="mt-8 flex flex-col gap-9"
    >
      <fieldset>
        <legend className="font-display text-xl font-semibold">{t("feedback.likedTitle")}</legend>
        <p className="mt-1 text-sm text-muted">{t("feedback.pickAny")}</p>
        {chips(liked, (f) => toggle(liked, setLiked, disliked, setDisliked, f), "up")}
        <label htmlFor={`${id}-ln`} className="mt-4 block text-sm font-medium">{t("feedback.likedNote")}</label>
        <textarea id={`${id}-ln`} value={likedNote} onChange={(e) => setLikedNote(e.target.value)} maxLength={2000} rows={3} className={`${box} mt-2`} />
      </fieldset>

      <fieldset>
        <legend className="font-display text-xl font-semibold">{t("feedback.dislikedTitle")}</legend>
        <p className="mt-1 text-sm text-muted">{t("feedback.pickAny")}</p>
        {chips(disliked, (f) => toggle(disliked, setDisliked, liked, setLiked, f), "down")}
        <label htmlFor={`${id}-dn`} className="mt-4 block text-sm font-medium">{t("feedback.dislikedNote")}</label>
        <textarea id={`${id}-dn`} value={dislikedNote} onChange={(e) => setDislikedNote(e.target.value)} maxLength={2000} rows={3} className={`${box} mt-2`} />
      </fieldset>

      <div>
        <label htmlFor={`${id}-w`} className="font-display text-xl font-semibold">{t("feedback.wishTitle")}</label>
        <p className="mt-1 text-sm text-muted">{t("feedback.wishHint")}</p>
        <textarea id={`${id}-w`} value={wishlist} onChange={(e) => setWishlist(e.target.value)} maxLength={3000} rows={5} className={`${box} mt-3`} />
      </div>

      <fieldset>
        <legend className="font-display text-xl font-semibold">{t("feedback.ratingTitle")}</legend>
        <div className="mt-3 flex gap-1" role="radiogroup" aria-label={t("feedback.ratingTitle")}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={t("feedback.ratingOf", { n })}
              onClick={() => setRating(rating === n ? null : n)}
              className="grid size-12 cursor-pointer place-items-center rounded-full hover:bg-ink-soft"
            >
              <Star aria-hidden="true" className={`size-7 ${rating && n <= rating ? "fill-[#d9a441] text-[#d9a441]" : "text-muted"}`} strokeWidth={1.5} />
            </button>
          ))}
        </div>
      </fieldset>

      <p className="text-sm text-muted">{t("feedback.privacy")}</p>
      {error && <p role="alert" className="rounded-xl border border-[#b4532a]/50 bg-[#b4532a]/5 p-4">{error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-12 cursor-pointer items-center justify-center self-start rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? t("feedback.sending") : t("feedback.send")}
      </button>
    </form>
  );
}
