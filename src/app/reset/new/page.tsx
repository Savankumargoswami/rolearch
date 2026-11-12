import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { t } from "@/i18n";
import { createClient } from "@/lib/supabase/server";
import { NewPasswordForm } from "../reset-forms";

export const metadata: Metadata = { title: t("auth.newTitle"), robots: { index: false } };

export default function NewPasswordPage() {
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-12 sm:px-6 sm:py-20">
      <Suspense fallback={<div className="h-80 w-full max-w-md animate-pulse rounded-3xl bg-ink-soft" aria-hidden="true" />}>
        <Gate />
      </Suspense>
    </div>
  );
}

/** Only for someone the reset link just signed in; anyone else is sent to ask for a link. */
async function Gate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/reset?error=link");
  return <NewPasswordForm />;
}
