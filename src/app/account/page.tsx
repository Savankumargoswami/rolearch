import { CircleCheck, CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { t } from "@/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: t("auth.accountTitle"), robots: { index: false } };

export default function AccountPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 sm:py-16">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">{t("auth.accountTitle")}</h1>
      <Suspense fallback={<div className="mt-8 h-56 animate-pulse rounded-2xl bg-ink-soft" aria-hidden="true" />}>
        <AccountDetails />
      </Suspense>
    </div>
  );
}

/** Reads the signed-in user, so it streams in behind the Suspense boundary. */
async function AccountDetails() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/signin");

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_type, full_name, company_name, website, company_domain_matches")
    .eq("id", user.id)
    .single();
  const company = profile?.account_type === "company";

  return (
    <>
      <dl className="mt-8 divide-y divide-line rounded-2xl border border-line bg-surface px-6">
        {profile?.full_name && <Row label={t("auth.name")} value={profile.full_name} />}
        <Row label={t("auth.accountEmail")} value={user.email ?? ""} />
        <Row label={t("auth.accountType")} value={company ? t("auth.accountCompany") : t("auth.accountSeeker")} />
        {company && <Row label={t("auth.accountCompanyName")} value={profile?.company_name ?? ""} />}
        {company && <Row label={t("auth.accountWebsite")} value={profile?.website ?? ""} />}
      </dl>

      {company && (
        <p className="mt-4 flex items-start gap-2 text-[0.95rem]">
          {profile?.company_domain_matches ? (
            <CircleCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-ink" />
          ) : (
            <CircleAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-signal-ink" />
          )}
          {profile?.company_domain_matches ? t("auth.accountDomainOk") : t("auth.accountDomainNo")}
        </p>
      )}

      <p className="mt-8 max-w-[60ch] text-muted">{company ? t("auth.accountNextCompany") : t("auth.accountNext")}</p>

      <form action={signOut} className="mt-8">
        <button type="submit" className="min-h-12 cursor-pointer rounded-full border border-ink px-6 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
          {t("auth.signOut")}
        </button>
      </form>
    </>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
      <dt className="text-muted">{label}</dt>
      <dd className="min-w-0 break-words font-medium">{value}</dd>
    </div>
  );
}
