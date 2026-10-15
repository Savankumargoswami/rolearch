"use client";

import { Camera, FileUp, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useId, useRef, useState, useTransition } from "react";
import { readResumeAction, removePhoto, saveProfile, uploadPhoto } from "@/app/account/profile/actions";
import { Avatar } from "@/components/avatar";
import { t } from "@/i18n";
import type { ProfileData } from "@/lib/profile-schema";

// The form keeps list fields as text while typing ("one per line", "comma separated"),
// and converts to arrays only when saving, so newlines and commas type naturally.
type ExperienceForm = Omit<ProfileData["resume"]["experience"][number], "bullets" | "skills"> & { bullets: string; skills: string };
type ProjectForm = Omit<ProfileData["resume"]["projects"][number], "skills"> & { skills: string };
type FormState = Omit<ProfileData, "resume"> & {
  resume: Omit<ProfileData["resume"], "experience" | "projects" | "skills"> & { experience: ExperienceForm[]; projects: ProjectForm[]; skills: string };
};

const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const commas = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

function toForm(p: ProfileData): FormState {
  return {
    ...p,
    resume: {
      ...p.resume,
      experience: p.resume.experience.map((e) => ({ ...e, bullets: e.bullets.join("\n"), skills: e.skills.join(", ") })),
      projects: p.resume.projects.map((x) => ({ ...x, skills: x.skills.join(", ") })),
      skills: p.resume.skills.join(", "),
    },
  };
}

function fromForm(f: FormState): ProfileData {
  return {
    ...f,
    resume: {
      ...f.resume,
      experience: f.resume.experience.map((e) => ({ ...e, end: e.current ? "" : e.end, bullets: lines(e.bullets), skills: commas(e.skills) })),
      projects: f.resume.projects.map((x) => ({ ...x, skills: commas(x.skills) })),
      skills: commas(f.resume.skills),
    },
  };
}

const blank = {
  experience: (): ExperienceForm => ({ title: "", company: "", location: "", start: "", end: "", current: false, bullets: "", skills: "" }),
  education: () => ({ school: "", degree: "", field: "", start: "", end: "" }),
  project: (): ProjectForm => ({ name: "", url: "", summary: "", skills: "" }),
  certification: () => ({ name: "", issuer: "", issued: "", expires: "", credentialId: "", url: "" }),
  link: () => ({ label: "", url: "" }),
};

export function ProfileEditor({ initial, initialPhoto, readerEnabled }: { initial: ProfileData; initialPhoto: string; readerEnabled: boolean }) {
  const [form, setForm] = useState<FormState>(() => toForm(initial));
  const [status, setStatus] = useState<{ kind: "ok" | "error" | "info"; text: string } | null>(null);
  const [reading, startReading] = useTransition();
  const [saving, startSaving] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState(initialPhoto);
  const [photoBusy, startPhoto] = useTransition();
  const photoRef = useRef<HTMLInputElement>(null);

  const r = form.resume;
  const setResume = (patch: Partial<FormState["resume"]>) => setForm((f) => ({ ...f, resume: { ...f.resume, ...patch } }));
  function listOps<K extends "experience" | "education" | "projects" | "certifications">(key: K) {
    type Item = FormState["resume"][K][number];
    const list = r[key] as Item[];
    return {
      list,
      update: (i: number, patch: Partial<Item>) => setResume({ [key]: list.map((x, j) => (j === i ? { ...x, ...patch } : x)) } as Partial<FormState["resume"]>),
      remove: (i: number) => setResume({ [key]: list.filter((_, j) => j !== i) } as Partial<FormState["resume"]>),
      add: (item: Item) => setResume({ [key]: [...list, item] } as Partial<FormState["resume"]>),
    };
  }
  const exp = listOps("experience");
  const edu = listOps("education");
  const proj = listOps("projects");
  const certs = listOps("certifications");

  function read() {
    const file = fileRef.current?.files?.[0];
    if (!file) return setStatus({ kind: "error", text: t("profile.errNoFile") });
    const data = new FormData();
    data.set("resume", file);
    setStatus({ kind: "info", text: t("profile.reading") });
    startReading(async () => {
      const res = await readResumeAction({}, data);
      if (res.draft) {
        const draft = res.draft;
        setForm((f) => toForm({ ...draft, full_name: draft.full_name || f.full_name }));
        setStatus({ kind: "ok", text: t("profile.drafted") });
      } else setStatus({ kind: "error", text: res.message ?? t("profile.errUnreadable") });
    });
  }

  function pickPhoto(file: File | undefined) {
    if (!file) return;
    const data = new FormData();
    data.set("photo", file);
    startPhoto(async () => {
      const res = await uploadPhoto(data);
      if (res.ok) setPhoto(res.url);
      setStatus(res.ok ? { kind: "ok", text: t("profile.photoSaved") } : { kind: "error", text: res.message });
      if (photoRef.current) photoRef.current.value = "";
    });
  }

  function dropPhoto() {
    startPhoto(async () => {
      const res = await removePhoto();
      if (res.ok) setPhoto("");
      setStatus(res.ok ? { kind: "ok", text: t("profile.photoRemoved") } : { kind: "error", text: res.message });
    });
  }

  function save() {
    startSaving(async () => {
      const res = await saveProfile(fromForm(form));
      setStatus(res.ok ? { kind: "ok", text: t("profile.saved") } : { kind: "error", text: res.message });
    });
  }

  return (
    <div className="mt-8 flex flex-col gap-8">
      <section aria-labelledby="upload-h" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="upload-h" className="font-display text-xl font-semibold">{t("profile.uploadTitle")}</h2>
        <p className="mt-1 text-muted">{readerEnabled ? t("profile.uploadBody") : t("profile.uploadBodyOff")}</p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-muted/60 px-4 py-2 text-[0.95rem] hover:border-ink">
            <FileUp aria-hidden="true" className="size-5 shrink-0 text-muted" />
            <span className="sr-only">{t("profile.uploadLabel")}</span>
            <input
              ref={fileRef}
              type="file"
              name="resume"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="min-w-0 flex-1 text-sm file:me-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-ink-soft file:px-3 file:py-1.5 file:text-ink"
            />
          </label>
          <button
            type="button"
            onClick={read}
            disabled={reading || !readerEnabled}
            className="min-h-12 shrink-0 cursor-pointer rounded-full bg-ink px-6 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-not-allowed disabled:opacity-60"
          >
            {reading ? t("profile.readingShort") : t("profile.readButton")}
          </button>
        </div>
        <p className="mt-2 text-sm text-muted">{t("profile.uploadHint")}</p>
      </section>

      <Section title={t("profile.basics")}>
        <div className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:gap-6">
          <div className={`transition-opacity duration-200 ${photoBusy ? "opacity-50" : ""}`}>
            <Avatar url={photo} name={form.full_name || "?"} size={112} className="ring-4 ring-signal ring-offset-4 ring-offset-surface" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold">{t("profile.photo")}</p>
            <p className="mt-1 max-w-[46ch] text-sm text-muted">{t("profile.photoHint")}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <label className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink ${photoBusy ? "pointer-events-none opacity-60" : ""}`}>
                <Camera aria-hidden="true" className="size-4" />
                {photoBusy ? t("profile.photoUploading") : photo ? t("profile.photoChange") : t("profile.photoAdd")}
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={photoBusy}
                  onChange={(e) => pickPhoto(e.target.files?.[0])}
                  className="sr-only"
                />
              </label>
              {photo && (
                <button type="button" onClick={dropPhoto} disabled={photoBusy} className="min-h-11 cursor-pointer rounded-full px-4 font-medium text-muted hover:bg-ink-soft hover:text-ink disabled:opacity-60">
                  {t("profile.photoRemove")}
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Text label={t("auth.name")} value={form.full_name} onChange={(v) => setForm({ ...form, full_name: v })} autoComplete="name" />
          <Text label={t("profile.location")} value={form.location} onChange={(v) => setForm({ ...form, location: v })} placeholder="Berlin, Germany" />
        </div>
        <Text label={t("profile.headline")} value={form.headline} onChange={(v) => setForm({ ...form, headline: v })} placeholder={t("profile.headlinePh")} />
        <fieldset>
          <legend className="text-[0.95rem] font-medium">{t("profile.status")}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {(["professional", "student"] as const).map((s) => (
              <label key={s} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-4 ${form.status === s ? "border-ink bg-ink text-paper" : "border-line bg-surface"}`}>
                <input type="radio" name="status" value={s} checked={form.status === s} onChange={() => setForm({ ...form, status: s })} className="sr-only" />
                {t(`profile.${s}` as const)}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <p className="text-[0.95rem] font-medium">{t("profile.links")}</p>
          <div className="mt-2 flex flex-col gap-2">
            {form.links.map((l, i) => (
              <div key={i} className="grid grid-cols-[8rem_1fr_auto] gap-2">
                <Text label={t("profile.linkLabel")} hideLabel value={l.label} placeholder="GitHub" onChange={(v) => setForm({ ...form, links: form.links.map((x, j) => (j === i ? { ...x, label: v } : x)) })} />
                <Text label={t("profile.linkUrl")} hideLabel value={l.url} placeholder="https://" type="url" onChange={(v) => setForm({ ...form, links: form.links.map((x, j) => (j === i ? { ...x, url: v } : x)) })} />
                <RemoveButton label={t("profile.remove")} onClick={() => setForm({ ...form, links: form.links.filter((_, j) => j !== i) })} />
              </div>
            ))}
          </div>
          <AddButton label={t("profile.addLink")} onClick={() => setForm({ ...form, links: [...form.links, blank.link()] })} />
        </div>
      </Section>

      <Section title={t("profile.experience")}>
        {exp.list.map((e, i) => (
          <Card key={i} onRemove={() => exp.remove(i)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label={t("profile.jobTitle")} value={e.title} onChange={(v) => exp.update(i, { title: v })} />
              <Text label={t("profile.company")} value={e.company} onChange={(v) => exp.update(i, { company: v })} />
              <Text label={t("profile.location")} value={e.location} onChange={(v) => exp.update(i, { location: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Text label={t("profile.start")} type="month" value={e.start} onChange={(v) => exp.update(i, { start: v })} />
                <Text label={t("profile.end")} type="month" value={e.current ? "" : e.end} disabled={e.current} onChange={(v) => exp.update(i, { end: v })} />
              </div>
            </div>
            <label className="flex min-h-11 items-center gap-2 text-[0.95rem]">
              <input type="checkbox" checked={e.current} onChange={(ev) => exp.update(i, { current: ev.target.checked })} className="size-[18px] accent-[var(--color-ink)]" />
              {t("profile.current")}
            </label>
            <Area label={t("profile.bullets")} hint={t("profile.bulletsHint")} value={e.bullets} onChange={(v) => exp.update(i, { bullets: v })} rows={4} />
            <Text label={t("profile.skillsUsed")} hint={t("profile.commaHint")} value={e.skills} onChange={(v) => exp.update(i, { skills: v })} />
          </Card>
        ))}
        <AddButton label={t("profile.addExperience")} onClick={() => exp.add(blank.experience())} />
      </Section>

      <Section title={t("profile.education")}>
        {edu.list.map((e, i) => (
          <Card key={i} onRemove={() => edu.remove(i)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label={t("profile.school")} value={e.school} onChange={(v) => edu.update(i, { school: v })} />
              <Text label={t("profile.degree")} value={e.degree} onChange={(v) => edu.update(i, { degree: v })} placeholder="BSc, MS, …" />
              <Text label={t("profile.field")} value={e.field} onChange={(v) => edu.update(i, { field: v })} />
              <div className="grid grid-cols-2 gap-2">
                <Text label={t("profile.startYear")} inputMode="numeric" value={e.start} onChange={(v) => edu.update(i, { start: v.slice(0, 4) })} placeholder="2020" />
                <Text label={t("profile.endYear")} inputMode="numeric" value={e.end} onChange={(v) => edu.update(i, { end: v.slice(0, 4) })} placeholder="2024" />
              </div>
            </div>
          </Card>
        ))}
        <AddButton label={t("profile.addEducation")} onClick={() => edu.add(blank.education())} />
      </Section>

      <Section title={t("profile.projects")}>
        {proj.list.map((p, i) => (
          <Card key={i} onRemove={() => proj.remove(i)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label={t("profile.projectName")} value={p.name} onChange={(v) => proj.update(i, { name: v })} />
              <Text label={t("profile.projectUrl")} type="url" value={p.url} onChange={(v) => proj.update(i, { url: v })} placeholder="https://github.com/…" />
            </div>
            <Area label={t("profile.projectSummary")} value={p.summary} onChange={(v) => proj.update(i, { summary: v })} rows={2} />
            <Text label={t("profile.skillsUsed")} hint={t("profile.commaHint")} value={p.skills} onChange={(v) => proj.update(i, { skills: v })} />
          </Card>
        ))}
        <AddButton label={t("profile.addProject")} onClick={() => proj.add(blank.project())} />
      </Section>

      <Section title={t("profile.certifications")}>
        {certs.list.map((c, i) => (
          <Card key={i} onRemove={() => certs.remove(i)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Text label={t("profile.certName")} value={c.name} onChange={(v) => certs.update(i, { name: v })} />
              <Text label={t("profile.issuer")} value={c.issuer} onChange={(v) => certs.update(i, { issuer: v })} />
              <Text label={t("profile.issued")} type="month" value={c.issued} onChange={(v) => certs.update(i, { issued: v })} />
              <Text label={t("profile.expires")} type="month" value={c.expires} onChange={(v) => certs.update(i, { expires: v })} />
              <Text label={t("profile.credentialId")} value={c.credentialId} onChange={(v) => certs.update(i, { credentialId: v })} />
              <Text label={t("profile.verifyUrl")} type="url" value={c.url} onChange={(v) => certs.update(i, { url: v })} placeholder="https://www.credly.com/badges/…" />
            </div>
          </Card>
        ))}
        <AddButton label={t("profile.addCertification")} onClick={() => certs.add(blank.certification())} />
      </Section>

      <Section title={t("profile.skills")}>
        <Area label={t("profile.skillsAll")} hint={t("profile.commaHint")} value={r.skills} onChange={(v) => setResume({ skills: v })} rows={3} />
      </Section>

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-line bg-paper/95 px-4 py-3 backdrop-blur-sm sm:-mx-6 sm:px-6">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-12 cursor-pointer rounded-full bg-ink px-7 font-medium text-paper transition-colors duration-200 hover:bg-ink-hover disabled:cursor-wait disabled:opacity-70"
        >
          {saving ? t("profile.saving") : t("profile.save")}
        </button>
        <Link href="/account" className="min-h-11 content-center px-2 font-medium underline underline-offset-4">
          {t("profile.viewProfile")}
        </Link>
        {status && (
          <p role={status.kind === "error" ? "alert" : "status"} className={`text-[0.95rem] ${status.kind === "error" ? "font-medium text-signal-ink" : "text-ink"}`}>
            {status.text}
          </p>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="border-b border-ink pb-2 font-display text-2xl font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Card({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <div className="relative flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 pt-12 sm:pt-5 sm:pe-14">
      <div className="absolute end-3 top-3">
        <RemoveButton label={t("profile.remove")} onClick={onRemove} />
      </div>
      {children}
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="grid size-11 cursor-pointer place-items-center rounded-full text-muted hover:bg-ink-soft hover:text-ink">
      <Trash2 aria-hidden="true" className="size-4" />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="mt-1 inline-flex min-h-11 cursor-pointer items-center gap-2 self-start rounded-full border border-ink px-4 font-medium transition-colors duration-200 hover:bg-ink hover:text-paper">
      <Plus aria-hidden="true" className="size-4" />
      {label}
    </button>
  );
}

type TextProps = { label: string; value: string; onChange: (v: string) => void; hint?: string; hideLabel?: boolean } & Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange"
>;

function Text({ label, value, onChange, hint, hideLabel, ...rest }: TextProps) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-[0.95rem] font-medium"}>
        {label}
      </label>
      <input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="h-12 w-full min-w-0 rounded-xl border border-line bg-surface px-4 outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)] disabled:bg-ink-soft disabled:text-muted"
        {...rest}
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}

function Area({ label, value, onChange, hint, rows }: { label: string; value: string; onChange: (v: string) => void; hint?: string; rows: number }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.95rem] font-medium">
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-describedby={hint ? `${id}-hint` : undefined}
        className="w-full rounded-xl border border-line bg-surface px-4 py-3 leading-relaxed outline-none transition-[border-color,box-shadow] duration-200 focus:border-ink focus:shadow-[0_0_0_3px_rgba(14,31,47,0.12)]"
      />
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
