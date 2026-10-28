// The application form of a job posted on Rolearch, like Greenhouse's or Workday's: standard fields the employer sets
// to required, optional or off, plus their own questions. Stored with the job (jobs.questions) as one list: custom
// questions ({q, kind, required, options?}) and standard fields ({std, mode}). Shared by the server and the browser.

export type FieldMode = "required" | "optional" | "off";
export type StdId = "phone" | "location" | "linkedin" | "website" | "coverLetter" | "workAuth" | "sponsorship" | "startDate" | "pay" | "source" | "adult";
export type StdField = { id: StdId; label: string; step: "info" | "experience" | "questions"; input: "tel" | "text" | "url" | "longtext" | "yesno" | "date" | "source"; mode: FieldMode };

/** The standard fields, in form order, with their default setting. */
export const STD_FIELDS: StdField[] = [
  { id: "phone", label: "Phone", step: "info", input: "tel", mode: "required" },
  { id: "location", label: "Current location (city, state)", step: "info", input: "text", mode: "required" },
  { id: "linkedin", label: "LinkedIn profile", step: "info", input: "url", mode: "optional" },
  { id: "website", label: "Website or portfolio", step: "info", input: "url", mode: "optional" },
  { id: "coverLetter", label: "Cover letter", step: "experience", input: "longtext", mode: "optional" },
  { id: "workAuth", label: "Are you legally authorized to work in the country where this job is based?", step: "questions", input: "yesno", mode: "required" },
  { id: "sponsorship", label: "Will you now or in the future require visa sponsorship for this job?", step: "questions", input: "yesno", mode: "required" },
  { id: "startDate", label: "Earliest start date", step: "questions", input: "date", mode: "optional" },
  { id: "pay", label: "Desired pay", step: "questions", input: "text", mode: "optional" },
  { id: "source", label: "How did you hear about this job?", step: "questions", input: "source", mode: "optional" },
  { id: "adult", label: "Are you 18 years of age or older?", step: "questions", input: "yesno", mode: "off" },
];

export const SOURCES = ["Rolearch", "LinkedIn", "Company website", "Referral from an employee", "Job board", "Social media", "Event or job fair", "Other"];

export type CustomKind = "yesno" | "text" | "longtext" | "choice";
export type CustomQuestion = { q: string; kind: CustomKind; required: boolean; options?: string[] };
type Stored = CustomQuestion | { std: StdId; mode: FieldMode };

export type FormConfig = { modes: Record<StdId, FieldMode>; custom: CustomQuestion[] };

export const MAX_CUSTOM = 10;
export const MAX_OPTIONS = 8;

/** A job's stored list as the form. Jobs posted before the form existed get the default standard fields. */
export function readForm(stored: unknown): FormConfig {
  const list = (Array.isArray(stored) ? stored : []) as Stored[];
  const std = list.filter((x): x is { std: StdId; mode: FieldMode } => Boolean(x) && typeof x === "object" && "std" in x);
  const modes = Object.fromEntries(STD_FIELDS.map((f) => [f.id, std.length ? "off" : f.mode])) as Record<StdId, FieldMode>;
  for (const s of std) if (STD_FIELDS.some((f) => f.id === s.std) && (s.mode === "required" || s.mode === "optional")) modes[s.std] = s.mode;
  const custom = list
    .filter((x): x is CustomQuestion => Boolean(x) && typeof x === "object" && "q" in x && typeof x.q === "string" && x.q.trim() !== "")
    .map((x) => ({
      q: x.q,
      kind: (["yesno", "text", "longtext", "choice"] as const).includes(x.kind) ? x.kind : "text",
      required: Boolean(x.required),
      ...(x.kind === "choice" ? { options: (x.options ?? []).filter((o) => typeof o === "string" && o.trim()).slice(0, MAX_OPTIONS) } : {}),
    }));
  return { modes, custom };
}

/** The form as stored with the job. Off fields are kept too, so a form with every field off doesn't read back as the default. */
export function writeForm(f: FormConfig): Stored[] {
  return [...STD_FIELDS.map((s) => ({ std: s.id, mode: f.modes[s.id] })), ...f.custom];
}

/** What an applicant sends: contact details, cover letter, standard answers and custom answers (by question). */
export type ApplicationInput = {
  firstName: string;
  lastName: string;
  phone: string;
  location: string;
  linkedin: string;
  website: string;
  coverLetter: string;
  std: Partial<Record<StdId, string>>;
  custom: Record<string, string>;
  attest: boolean;
};
