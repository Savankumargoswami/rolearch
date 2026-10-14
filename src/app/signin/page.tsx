import type { Metadata } from "next";
import { AuthFormInner } from "@/components/auth-form";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.signInTitle"), alternates: { canonical: "/signin" } };

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-12 sm:px-6 sm:py-20">
      <AuthFormInner mode="signin" initialKind="seeker" />
    </div>
  );
}
