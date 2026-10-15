import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm, AuthFormInner } from "@/components/auth-form";
import { t } from "@/i18n";

export const metadata: Metadata = { title: t("auth.signInTitle"), alternates: { canonical: "/signin" } };

export default function SignInPage() {
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-12 sm:px-6 sm:py-20">
      <Suspense fallback={<AuthFormInner mode="signin" initialKind="seeker" />}>
        <AuthForm mode="signin" />
      </Suspense>
    </div>
  );
}
