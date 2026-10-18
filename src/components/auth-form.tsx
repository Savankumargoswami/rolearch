"use client";

import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useId, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/auth/actions";
import { t } from "@/i18n";

type Kind = "seeker" | "company";

export function AuthForm({ mode }: { mode: "signup" | "signin" }) {
  const params = useSearchParams();
  return (
    <AuthFormInner
      mode={mode}
      initialKind={params.get("as") === "company" ? "company" : "seeker"}
      linkError={params.get("error") === "link"}
    />
  );
}

export function AuthFormInner({ mode, initialKind, linkError = false }: { mode: "signup" | "signin"; initialKind: Kind; linkError?: boolean }) {
  const signup = mode === "signup";
  const [kind, setKind] = useState<Kind>(initialKind);
  const [state, action, pending] = useActionState<AuthState, FormData>(signup ? signUp : signIn, {});
  const errors = state.errors ?? {};
  const v = state.values ?? {};

  if (state.sent) {
    return (
      <div className="w-full max-w-md" role="status">
        <MailCheck aria-hidden="true" className="size-10 text-ink" strokeWidth={1.5} />
        <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.03em]">{t("auth.checkTitle")}</h1>
        <p className="mt-3 text-lg text-pretty">{t("auth.checkBody", { email: state.sent })}</p>
        <p className="mt-3 text-muted">{t("auth.checkHint")}</p>
        <Link href="/signin" className="mt-8 inline-flex min-h-12 items-center rounded-full border border-ink px-6 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
          {t("auth.goSignIn")}
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">{signup ? t("auth.signUpTitle") : t("auth.signInTitle")}</h1>

      {signup && (
        <div role="tablist" aria-label="Account type" className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-ink-soft p-1">
          {(["seeker", "company"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => setKind(k)}
              className={`min-h-11 cursor-pointer rounded-full text-[0.95rem] font-medium transition-[background-color,color,box-shadow] duration-200 ${
                kind === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(14,31,47,0.15)]" : "text-muted hover:text-ink"
              }`}
            >
              {t(`auth.${k}` as const)}
            </button>
          ))}
        </div>
      )}

      {(state.message || linkError) && (
        <p role="alert" className="mt-5 rounded-xl border border-signal-ink/30 bg-[#fbf3e7] px-4 py-3 text-[0.95rem]">
          {state.message ?? t("auth.errLink")}
        </p>
      )}

      <form action={action} noValidate className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="kind" value={signup ? kind : "seeker"} />
        {signup && <Field name="name" label={t("auth.name")} autoComplete="name" defaultValue={v.name} error={errors.name} />}
        {signup && kind === "company" && (
          <>
            <Field name="company" label={t("auth.companyName")} autoComplete="organization" defaultValue={v.company} error={errors.company} />
            <Field name="website" label={t("auth.website")} type="url" inputMode="url" placeholder="https://" defaultValue={v.website} error={errors.website} />
          </>
        )}
        <Field
          name="email"
          label={signup && kind === "company" ? t("auth.workEmail") : t("auth.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          defaultValue={v.email}
          hint={signup && kind === "company" ? t("auth.workEmailHint") : undefined}
          error={errors.email}
        />
        <Field
          name="password"
          label={t("auth.password")}
          type="password"
          autoComplete={signup ? "new-password" : "current-password"}
          hint={signup ? t("auth.passwordHint") : undefined}
          error={errors.password}
        />
        <button
          type="submit"
          disabled={pending}
          className="mt-2 min-h-12 cursor-pointer rounded-full bg-ink font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-wait disabled:opacity-70"
        >
          {pending ? t("auth.working") : !signup ? t("auth.submitSignIn") : kind === "company" ? t("auth.submitCompany") : t("auth.submitSeeker")}
        </button>
      </form>

      {signup && (
        <p className="mt-4 text-sm text-muted">
          {t("auth.termsLead")}{" "}
          <Link href="/terms" className="font-medium text-ink underline underline-offset-4">
            {t("footer.terms")}
          </Link>{" "}
          {t("auth.termsAnd")}{" "}
          <Link href="/privacy" className="font-medium text-ink underline underline-offset-4">
            {t("footer.privacy")}
          </Link>
          .
        </p>
      )}
      <p className="mt-6 text-[0.95rem]">
        {signup ? t("auth.haveAccount") : t("auth.noAccount")}{" "}
        <Link href={signup ? "/signin" : "/signup"} className="font-medium underline underline-offset-4">
          {signup ? t("nav.signIn") : t("nav.signUp")}
        </Link>
      </p>
    </div>
  );
}

function Field({
  name,
  label,
  hint,
  error,
  ...input
}: { name: string; label: string; hint?: string; error?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  const describedBy = [hint && `${id}-hint`, error && `${id}-err`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.95rem] font-medium">
        {label}
      </label>
      <input
        id={id}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`h-12 rounded-xl border bg-surface px-4 text-[1rem] outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)] ${
          error ? "border-signal-ink" : "border-line"
        }`}
        {...input}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-err`} className="text-sm font-medium text-signal-ink">
          {error}
        </p>
      )}
    </div>
  );
}
