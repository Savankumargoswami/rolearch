"use client";

import { Check, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { t } from "@/i18n";
import { savePreferences } from "./preferences-actions";

type Prefs = { targetRoles: string[]; experience: string; locations: string[]; workMode: "any" | "remote" | "hybrid" | "onsite" };
const EXPERIENCE = ["0-2", "3-5", "6-10", "10+"];
const MODES = ["any", "remote", "hybrid", "onsite"] as const;

const split = (s: string) => s.split(",").map((x) => x.trim()).filter(Boolean);

/** Job preferences: the roles you're aiming for, your experience, where and how you can work. */
export function PreferencesForm({ initial }: { initial: Prefs }) {
  const [roles, setRoles] = useState(initial.targetRoles.join(", "));
  const [experience, setExperience] = useState(initial.experience);
  const [locations, setLocations] = useState(initial.locations.join(", "));
  const [workMode, setWorkMode] = useState<Prefs["workMode"]>(initial.workMode);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [busy, start] = useTransition();
  const save = () =>
    start(async () => {
      setError("");
      setSaved(false);
      const res = await savePreferences({ targetRoles: split(roles), experience, locations: split(locations), workMode });
      if (res.ok) setSaved(true);
      else setError(res.message ?? "");
    });

  return (
    <section aria-labelledby="prefs-h" className="mt-8 rounded-2xl border border-line bg-surface p-5">
      <h2 id="prefs-h" className="font-display text-xl font-semibold">
        {t("prefs.title")}
      </h2>
      <p className="mt-1 text-sm text-muted">{t("prefs.lead")}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">{t("prefs.roles")}</span>
          <input value={roles} onChange={(e) => setRoles(e.target.value)} placeholder={t("prefs.rolesPh")} maxLength={300} className="h-11 rounded-xl border border-line bg-paper/40 px-3" />
          <span className="text-muted">{t("profile.commaHint")}</span>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("prefs.experience")}</span>
          <select value={experience} onChange={(e) => setExperience(e.target.value)} className="h-11 rounded-xl border border-line bg-surface px-2">
            <option value="">{t("prefs.choose")}</option>
            {EXPERIENCE.map((x) => (
              <option key={x} value={x}>
                {t("prefs.years", { range: x })}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("prefs.workMode")}</span>
          <select value={workMode} onChange={(e) => setWorkMode(e.target.value as Prefs["workMode"])} className="h-11 rounded-xl border border-line bg-surface px-2">
            {MODES.map((m) => (
              <option key={m} value={m}>
                {t(`prefs.mode_${m}`)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm sm:col-span-2">
          <span className="font-medium">{t("prefs.locations")}</span>
          <input value={locations} onChange={(e) => setLocations(e.target.value)} placeholder={t("prefs.locationsPh")} maxLength={300} className="h-11 rounded-xl border border-line bg-paper/40 px-3" />
        </label>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy}
        className="mt-4 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
      >
        {busy ? <Loader2 aria-hidden="true" className="size-4 animate-spin" /> : saved ? <Check aria-hidden="true" className="size-4" /> : null}
        {saved ? t("prefs.saved") : t("prefs.save")}
      </button>
      {error && <p role="alert" className="mt-2 text-sm text-[#b4532a]">{error}</p>}
    </section>
  );
}
