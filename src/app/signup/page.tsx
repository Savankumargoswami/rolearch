import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthForm, AuthFormInner } from "@/components/auth-form";
import { t } from "@/i18n";
import { enabledProviders } from "@/lib/auth-providers";

export const metadata: Metadata = { title: t("auth.signUpTitle"), alternates: { canonical: "/signup" } };

export default function SignUpPage() {
  return (
    <div className="mx-auto flex max-w-6xl justify-center px-4 py-12 sm:px-6 sm:py-20">
      <Suspense fallback={<AuthFormInner mode="signup" initialKind="seeker" />}>
        <WithProviders />
      </Suspense>
    </div>
  );
}

async function WithProviders() {
  return <AuthForm mode="signup" providers={await enabledProviders()} />;
}
