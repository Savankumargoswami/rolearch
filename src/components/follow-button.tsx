"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import { setFollow } from "@/app/posts/actions";
import { t } from "@/i18n";

/** Follow / Following toggle. Updates right away and rolls back if saving fails. */
export function FollowButton({ profileId, initialFollowing }: { profileId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function toggle() {
    const next = !following;
    setFollowing(next);
    setError("");
    start(async () => {
      const res = await setFollow(profileId, next);
      if (!res.ok) {
        setFollowing(!next);
        setError(res.message);
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={following}
        className={`inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full px-6 font-medium transition-[background-color,color,transform] duration-200 active:scale-95 ${
          following ? "border border-white/40 text-paper hover:border-signal" : "bg-signal text-ink hover:bg-[#ebb877]"
        }`}
      >
        {following ? <UserCheck aria-hidden="true" className="size-4" /> : <UserPlus aria-hidden="true" className="size-4" />}
        {following ? t("social.following") : t("social.follow")}
      </button>
      {error && (
        <p role="alert" className="text-sm text-signal">
          {error}
        </p>
      )}
    </div>
  );
}
