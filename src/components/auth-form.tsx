"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useId, useState } from "react";
import { t } from "@/i18n";

type Kind = "seeker" | "company";
type Errors = Partial<Record<"name" | "email" | "password" | "company" | "website", string>>;

const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

function hostOf(url: string): string | null {
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export function AuthForm({ mode }: { mode: "signup" | "signin" }) {
  const params = useSearchParams();
  return <AuthFormInner mode={mode} initialKind={params.get("as") === "company" ? "company" : "seeker"} />;
}

export function AuthFormInner({ mode, initialKind }: { mode: "signup" | "signin"; initialKind: Kind }) {
  const [kind, setKind] = useState<Kind>(initialKind);
  const [errors, setErrors] = useState<Errors>({});
  const [done, setDone] = useState(false);
  const signup = mode === "signup";

  function validate(form: FormData): Errors {
    const e: Errors = {};
    const get = (k: string) => String(form.get(k) ?? "").trim();
    if (signup && kind === "seeker" && !get("name")) e.name = t("auth.errName");
    if (signup && kind === "company") {
      if (!get("company")) e.company = t("auth.errCompany");
      const host = hostOf(get("website"));
      if (!host || !host.includes(".")) e.website = t("auth.errWebsite");
      const email = get("email");
      if (!emailOk(email)) e.email = t("auth.errEmail");
      else if (host && !email.toLowerCase().endsWith(`@${host}`)) e.email = t("auth.errDomain", { d: host });
    } else if (!emailOk(get("email"))) e.email = t("auth.errEmail");
    if (get("password").length < 10) e.password = t("auth.errPassword");
    return e;
  }

  return (
    <div className="w-full max-w-md">
      <h1 className="font-display text-4xl font-semibold tracking-[-0.03em]">{signup ? t("auth.signUpTitle") : t("auth.signInTitle")}</h1>
      <p className="mt-3 rounded-xl bg-ink-soft px-4 py-3 text-sm">{t("auth.preview")}</p>

      {signup && (
        <div role="tablist" aria-label="Account type" className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-ink-soft p-1">
          {(["seeker", "company"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={kind === k}
              onClick={() => {
                setKind(k);
                setErrors({});
                setDone(false);
              }}
              className={`min-h-11 cursor-pointer rounded-full text-[0.95rem] font-medium transition-[background-color,color,box-shadow] duration-200 ${
                kind === k ? "bg-surface text-ink shadow-[0_1px_2px_rgba(14,31,47,0.15)]" : "text-muted hover:text-ink"
              }`}
            >
              {t(`auth.${k}` as const)}
            </button>
          ))}
        </div>
      )}

      {kind === "seeker" && (
        <>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button type="button" className="min-h-12 cursor-pointer rounded-full border border-line bg-surface font-medium transition-colors duration-200 hover:border-ink">
              {t("auth.google")}
            </button>
            <button type="button" className="min-h-12 cursor-pointer rounded-full border border-line bg-surface font-medium transition-colors duration-200 hover:border-ink">
              {t("auth.github")}
            </button>
          </div>
          <div className="my-5 flex items-center gap-3 text-sm text-muted">
            <span className="h-px flex-1 bg-line" />
            {t("auth.or")}
            <span className="h-px flex-1 bg-line" />
          </div>
        </>
      )}

      <form
        noValidate
        className={`flex flex-col gap-4 ${kind === "company" ? "mt-6" : ""}`}
        onSubmit={(e) => {
          e.preventDefault();
          const errs = validate(new FormData(e.currentTarget));
          setErrors(errs);
          setDone(Object.keys(errs).length === 0);
          const first = Object.keys(errs)[0];
          if (first) (e.currentTarget.elements.namedItem(first) as HTMLElement | null)?.focus();
        }}
      >
        {signup && kind === "seeker" && <Field name="name" label={t("auth.name")} autoComplete="name" error={errors.name} />}
        {signup && kind === "company" && (
          <>
            <Field name="company" label={t("auth.companyName")} autoComplete="organization" error={errors.company} />
            <Field name="website" label={t("auth.website")} type="url" inputMode="url" placeholder="https://" error={errors.website} />
          </>
        )}
        <Field
          name="email"
          label={signup && kind === "company" ? t("auth.workEmail") : t("auth.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
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
        <button type="submit" className="mt-2 min-h-12 cursor-pointer rounded-full bg-ink font-medium text-paper transition-colors duration-200 hover:bg-ink-hover">
          {!signup ? t("auth.submitSignIn") : kind === "company" ? t("auth.submitCompany") : t("auth.submitSeeker")}
        </button>
        <p role="status" className={`text-sm ${done ? "text-ink" : "sr-only"}`}>
          {done ? t("auth.done") : ""}
        </p>
      </form>

      {signup && <p className="mt-4 text-sm text-muted">{t("auth.terms")}</p>}
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
