"use client";

import { Check, Hand, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { setInterest } from "@/app/posts/actions";
import { t } from "@/i18n";

/** "I'm interested" on someone's hiring post: tells the author (by email) and lists the member under the post. */
export function InterestButton({ postId, interested }: { postId: string; interested: boolean }) {
  const [on, setOn] = useState(interested);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const res = await setInterest(postId, !on);
      if (res.ok) {
        setOn(!on);
        setError("");
      } else setError(res.message);
    });
  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={`inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors disabled:opacity-60 ${on ? "border border-ink" : "bg-ink text-paper hover:bg-ink-hover"}`}
      >
        {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : on ? <Check aria-hidden="true" className="size-4" /> : <Hand aria-hidden="true" className="size-4" />}
        {on ? t("posts.interestedOn") : t("posts.interested")}
      </button>
      {on && !error && <span className="text-sm text-muted">{t("posts.interestedNote")}</span>}
      {error && <span role="alert" className="text-sm text-[#b4532a]">{error}</span>}
    </div>
  );
}
