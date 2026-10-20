"use client";

import { MailCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState, useEffect, useId, useState, useTransition } from "react";
import { oauthSignIn, resendConfirmation, signIn, signUp, type AuthState } from "@/app/auth/actions";
import { t } from "@/i18n";
import type { Providers } from "@/lib/auth-providers";

type Kind = "seeker" | "company";

export function AuthForm({ mode, providers }: { mode: "signup" | "signin"; providers?: Providers }) {
  const params = useSearchParams();
  return (
    <AuthFormInner
      mode={mode}
      initialKind={params.get("as") === "company" ? "company" : "seeker"}
      linkError={params.get("error") === "link"}
      oauthError={params.get("error") === "oauth"}
      next={params.get("next") ?? ""}
      providers={providers}
    />
  );
}

export function AuthFormInner({
  mode,
  initialKind,
  linkError = false,
  oauthError = false,
  next = "",
  providers = { google: false, github: false },
}: {
  mode: "signup" | "signin";
  initialKind: Kind;
  linkError?: boolean;
  oauthError?: boolean;
  next?: string;
  providers?: Providers;
}) {
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
        <ResendConfirmation email={state.sent} next={next} />
        <p className="mt-6 flex items-start gap-2 rounded-xl border border-line bg-surface p-3 text-sm text-muted">
          <ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-signal-ink" />
          {t("auth.checkSafety")}
        </p>
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

      {(state.message || linkError || oauthError) && (
        <p role="alert" className="mt-5 rounded-xl border border-signal-ink/30 bg-[#fbf3e7] px-4 py-3 text-[0.95rem]">
          {state.message ?? (oauthError ? t("auth.errOauth") : t("auth.errLink"))}
        </p>
      )}

      {(!signup || kind === "seeker") && (providers.google || providers.github) && (
        <>
          <div className="mt-6 grid gap-2">
            {providers.google && <OAuthButton provider="google" next={next} />}
            {providers.github && <OAuthButton provider="github" next={next} />}
          </div>
          <div className="mt-6 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("auth.orEmail")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form action={action} noValidate className="mt-6 flex flex-col gap-4">
        <input type="hidden" name="kind" value={signup ? kind : "seeker"} />
        <input type="hidden" name="next" value={next} />
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
          hint={signup ? (kind === "company" ? t("auth.workEmailHint") : t("auth.emailHint")) : undefined}
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
        <Link href={`${signup ? "/signin" : "/signup"}${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-medium underline underline-offset-4">
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

/** "Continue with Google / GitHub": a tiny form so it works before JavaScript loads. */
function OAuthButton({ provider, next }: { provider: "google" | "github"; next: string }) {
  return (
    <form action={oauthSignIn}>
      <input type="hidden" name="provider" value={provider} />
      <input type="hidden" name="next" value={next} />
      <button
        type="submit"
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2.5 whitespace-nowrap rounded-full border border-line bg-surface px-4 font-medium transition-colors duration-200 hover:border-ink"
      >
        {provider === "google" ? <GoogleMark /> : <GitHubMark />}
        {provider === "google" ? t("auth.continueGoogle") : t("auth.continueGithub")}
      </button>
    </form>
  );
}

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="size-5">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5" fill="currentColor">
      <path d="M12 .5C5.7.5.5 5.7.5 12c0 5.1 3.3 9.4 7.9 10.9.6.1.8-.3.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.7 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.9 1.2 3.1 0 4.4-2.7 5.4-5.3 5.7.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5z" />
    </svg>
  );
}

/** "Resend the email", with a 60-second wait between sends. */
function ResendConfirmation({ email, next }: { email: string; next: string }) {
  const [wait, setWait] = useState(60);
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);
  return (
    <div className="mt-4">
      <button
        type="button"
        disabled={pending || wait > 0}
        onClick={() =>
          start(async () => {
            const res = await resendConfirmation(email, next);
            setStatus(res.ok ? { ok: true, text: t("auth.resent") } : { ok: false, text: res.message ?? t("auth.errGeneric") });
            setWait(60);
          })
        }
        className="inline-flex min-h-11 cursor-pointer items-center font-medium underline decoration-line underline-offset-4 hover:decoration-ink disabled:cursor-not-allowed disabled:text-muted disabled:no-underline"
      >
        {pending ? t("auth.resending") : t("auth.resend")}
      </button>
      {wait > 0 && !pending && <span className="ms-2 text-sm text-muted tabular-nums">{t("auth.resendWait", { s: wait })}</span>}
      {status && (
        <p role="status" className={`mt-1 text-sm ${status.ok ? "text-muted" : "text-[#b4532a]"}`}>
          {status.text}
        </p>
      )}
    </div>
  );
}
