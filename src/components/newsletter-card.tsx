import { Mail } from "lucide-react";
import { t } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import { NewsletterToggle } from "./newsletter-toggle";

/** The weekly email opt-in on the account page. Render it inside a Suspense boundary. */
export async function NewsletterCard({ userId }: { userId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.from("newsletter").select("subscribed, category").eq("user_id", userId).maybeSingle();
  return (
    <aside className="mt-8 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <Mail aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-signal-ink" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("newsletter.title")}</p>
          <p className="text-sm text-muted">{t("newsletter.body")}</p>
          <NewsletterToggle subscribed={data?.subscribed ?? false} category={data?.category ?? "all"} />
        </div>
      </div>
    </aside>
  );
}
