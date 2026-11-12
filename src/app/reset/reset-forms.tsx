"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { requestPasswordReset, setNewPassword, type AuthState } from "@/app/auth/actions";
import { Field } from "@/components/auth-form";
import { t } from "@/i18n";

const button =
  "mt-2 min-h-12 cursor-pointer rounded-full bg-ink font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-wait disabled:opacity-70";

function Message({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="alert" className="mt-5 rounded-xl border border-signal-ink/30 bg-[#fbf3e7] px-4 py-3 text-[0.95rem]">
      {text}
    </p>
  );
}

/** Step 1: ask for a reset link. */
export function RequestResetForm({ linkExpired }: { linkExpired: boolean }) {
  const [state, action, pending] = useActionState<AuthState, FormData>(requestPasswordReset, {});
  if (state.sent) {
    return (
      <div className="w-full max-w-md" role="status">
        <MailCheck aria-hidden="true" className="size-10 text-ink" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em]">{t("auth.resetSentTitle")}</h1>
        <p className="mt-3 text-lg text-pretty">{t("auth.resetSent", { email: state.sent })}</p>
        <p className="mt-3 text-muted">{t("auth.checkHint")}</p>
        <Link href="/signin" className="mt-8 inline-flex min-h-12 items-center rounded-full border border-ink px-6 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
          {t("auth.backToSignIn")}
        </Link>
      </div>
    );
  }
  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">{t("auth.resetTitle")}</h1>
      <p className="mt-3 text-pretty text-muted">{t("auth.resetLead")}</p>
      <Message text={state.message ?? (linkExpired ? t("auth.errResetLink") : undefined)} />
      <form action={action} noValidate className="mt-6 flex flex-col gap-4">
        <Field name="email" label={t("auth.email")} type="email" inputMode="email" autoComplete="email" defaultValue={state.values?.email} error={state.errors?.email} />
        <button type="submit" disabled={pending} className={button}>
          {pending ? t("auth.working") : t("auth.resetSubmit")}
        </button>
      </form>
      <p className="mt-4 text-sm text-muted">{t("auth.resetOAuthNote")}</p>
      <p className="mt-6 text-[0.95rem]">
        <Link href="/signin" className="font-medium underline underline-offset-4">
          {t("auth.backToSignIn")}
        </Link>
      </p>
    </div>
  );
}

/** Step 2: the reset link signed the person in; they choose a new password. */
export function NewPasswordForm() {
  const [state, action, pending] = useActionState<AuthState, FormData>(setNewPassword, {});
  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">{t("auth.newTitle")}</h1>
      <p className="mt-3 text-pretty text-muted">{t("auth.newLead")}</p>
      <Message text={state.message} />
      <form action={action} noValidate className="mt-6 flex flex-col gap-4">
        <Field name="password" label={t("auth.newPassword")} type="password" autoComplete="new-password" hint={t("auth.passwordHint")} error={state.errors?.password} />
        <button type="submit" disabled={pending} className={button}>
          {pending ? t("auth.working") : t("auth.newSubmit")}
        </button>
      </form>
    </div>
  );
}
