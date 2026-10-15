"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deletePost } from "@/app/posts/actions";
import { t } from "@/i18n";

/** Two-step delete: the first tap asks, the second deletes. */
export function DeletePostButton({ id }: { id: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  function onClick() {
    if (!confirming) return setConfirming(true);
    start(async () => {
      const res = await deletePost(id);
      if (res.ok) router.refresh();
      else {
        setError(res.message);
        setConfirming(false);
      }
    });
  }

  return (
    <div className="flex items-center gap-2">
      {error && (
        <span role="alert" className="text-sm text-signal-ink">
          {error}
        </span>
      )}
      {confirming && !pending && (
        <button type="button" onClick={() => setConfirming(false)} className="min-h-10 cursor-pointer rounded-full px-3 text-sm text-muted hover:bg-ink-soft">
          {t("posts.cancel")}
        </button>
      )}
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={`inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm ${confirming ? "bg-ink font-medium text-paper" : "text-muted hover:bg-ink-soft hover:text-ink"}`}
      >
        <Trash2 aria-hidden="true" className="size-4" />
        {pending ? t("posts.deleting") : confirming ? t("posts.confirmDelete") : t("posts.delete")}
      </button>
    </div>
  );
}
