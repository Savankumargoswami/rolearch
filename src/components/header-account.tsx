import { LogIn, UserRound } from "lucide-react";
import Link from "next/link";
import { cookies } from "next/headers";
import { t } from "@/i18n";
import { authConfigured, createClient } from "@/lib/supabase/server";
import { type MenuItem, MobileMenu } from "./mobile-menu";
import { NavLink } from "./nav-link";

const buttonClass =
  "inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-ink px-3 text-[0.95rem] font-medium text-paper transition-colors duration-200 hover:bg-ink-hover sm:px-4";

const common: MenuItem[] = [
  { href: "/skills", label: t("nav.skills"), icon: "skills" },
  { href: "/ats", label: t("nav.ats"), icon: "ats" },
  { href: "/roadmaps", label: t("nav.roadmaps"), icon: "roadmaps" },
  { href: "/guides", label: t("nav.guides"), icon: "guides" },
  { href: "/blog", label: t("nav.blog"), icon: "blog" },
  { href: "/features", label: t("nav.features"), icon: "features" },
];

/** Shown to visitors who aren't signed in, and as the placeholder while the session is read. */
export function GuestLinks() {
  return (
    <>
      <Link href="/signin" className={buttonClass}>
        <LogIn aria-hidden="true" className="size-4 max-sm:hidden" />
        {t("nav.signIn")}
      </Link>
      <MobileMenu
        items={[
          { href: "/signup", label: t("nav.signUp"), icon: "join", primary: true },
          { href: "/discover", label: t("nav.discover"), icon: "discover" },
          ...common,
          { href: "/feed", label: t("nav.posts"), icon: "posts" },
          { href: "/employers", label: t("nav.companies"), icon: "companies" },
        ]}
      />
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
  const items: MenuItem[] = [
    { href: "/dashboard", label: t("nav.dashboard"), icon: "dashboard" },
    company ? { href: "/hire", label: t("nav.hiring"), icon: "hiring" } : { href: "/tracker", label: t("nav.tracker"), icon: "tracker" },
    { href: "/discover", label: t("nav.discover"), icon: "discover" },
    { href: "/gaps", label: t("nav.gaps"), icon: "gaps" },
    { href: "/account/resumes", label: t("nav.versions"), icon: "versions" },
    { href: "/interview", label: t("nav.interview"), icon: "interview" },
    { href: "/feed", label: t("nav.posts"), icon: "posts" },
    ...common,
  ];
  if (!company) items.push({ href: "/employers", label: t("nav.companies"), icon: "companies" });
  else items.splice(1, 0, { href: "/hire/talent", label: t("nav.talent"), icon: "talent" });
  items.push({ href: "/account/privacy", label: t("nav.privacy"), icon: "privacy" });
  return (
    <>
      <NavLink href="/account" className={buttonClass}>
        <UserRound aria-hidden="true" className="size-4" />
        <span className="hidden min-[400px]:inline">{t("nav.profile")}</span>
        <span className="sr-only min-[400px]:hidden">{t("nav.profile")}</span>
      </NavLink>
      <MobileMenu items={items} />
    </>
  );
}
