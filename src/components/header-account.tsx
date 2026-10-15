import Link from "next/link";
import { cookies } from "next/headers";
import { t } from "@/i18n";
import { authConfigured, createClient } from "@/lib/supabase/server";

const buttonClass =
  "inline-flex min-h-11 items-center whitespace-nowrap rounded-full bg-ink px-4 text-[0.95rem] font-medium text-paper transition-colors duration-200 hover:bg-ink-hover";

/** Shown to visitors who aren't signed in, and as the placeholder while the session is read. */
export function GuestLinks() {
  return (
    <>
      <Link href="/signin" className="hidden whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft min-[400px]:inline-block">
        {t("nav.signIn")}
      </Link>
      <Link href="/signup" className={buttonClass}>
        {t("nav.signUp")}
      </Link>
    </>
  );
}

/** Reads the session cookie, so the header renders it behind a Suspense boundary. */
export async function HeaderAccount() {
  const hasSession = (await cookies()).getAll().some((c) => c.name.startsWith("sb-"));
  if (!authConfigured || !hasSession) return <GuestLinks />;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return <GuestLinks />;
  return (
    <>
      <Link href="/feed" className="whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft">
        {t("nav.posts")}
      </Link>
      <Link href="/account" className={buttonClass}>
        {t("auth.account")}
      </Link>
    </>
  );
}
