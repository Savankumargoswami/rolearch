import { BellRing } from "lucide-react";
import Link from "next/link";
import { t } from "@/i18n";
import { loadPreferences } from "@/lib/preferences";
import { createClient } from "@/lib/supabase/server";
import { JobAlertsToggle } from "./job-alerts-toggle";

/** Job alerts as notifications on this device (db/052), for the member's first target role. Render inside Suspense. */
export async function JobAlertsCard() {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) return null;
  const role = (await loadPreferences(await createClient())).targetRoles[0] ?? "";
  return (
    <aside className="mt-4 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-start gap-3">
        <BellRing aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-signal-ink" strokeWidth={1.75} />
        <div className="min-w-0 flex-1">
          <p className="font-medium">{t("jobAlerts.title")}</p>
          {role ? (
            <>
              <p className="text-sm text-muted text-pretty">{t("jobAlerts.body", { role })}</p>
              <JobAlertsToggle publicKey={key} />
            </>
          ) : (
            <p className="text-sm text-muted text-pretty">
              {t("jobAlerts.needRole")}{" "}
              <Link href="/account/profile#prefs-h" className="font-medium text-ink underline decoration-line underline-offset-4 hover:decoration-ink">
                {t("jobAlerts.addRole")}
              </Link>
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
