import Link from "next/link";
import { cookies } from "next/headers";
import { t } from "@/i18n";
import { authConfigured, createClient } from "@/lib/supabase/server";
import { NavLink } from "./nav-link";

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
        <span className="min-[420px]:hidden">{t("nav.join")}</span>
        <span className="hidden min-[420px]:inline">{t("nav.signUp")}</span>
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
  const company = user.user_metadata?.account_type === "company";
  return (
    <>
      <NavLink
        href={company ? "/hire" : "/tracker"}
        className="hidden whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft min-[480px]:inline-block"
      >
        {company ? t("nav.hiring") : t("nav.tracker")}
      </NavLink>
      <NavLink href="/feed" className="hidden whitespace-nowrap rounded-md px-3 py-2 text-[0.95rem] text-ink hover:bg-ink-soft min-[420px]:inline-block">
        {t("nav.posts")}
      </NavLink>
      <Link href="/account" className={buttonClass}>
        {t("auth.account")}
      </Link>
    </>
  );
}
