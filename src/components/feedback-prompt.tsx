import { MessageSquareHeart } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/** Asks a member for feedback until they've given some. Render it inside a Suspense boundary. */
export async function FeedbackPrompt() {
  const viewer = await loadViewer();
  if (!viewer) return null;
  const db = await createClient();
  const { count } = await db.from("feedback").select("id", { count: "exact", head: true }).eq("user_id", viewer.id);
  if (count) return null;
  return (
    <aside className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <MessageSquareHeart aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-signal-ink" strokeWidth={1.75} />
        <div>
          <p className="font-medium">{t("feedback.promptTitle")}</p>
          <p className="text-sm text-muted">{t("feedback.promptBody")}</p>
        </div>
      </div>
      <Link href="/feedback" className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover">
        {t("feedback.promptCta")}
      </Link>
    </aside>
  );
}
