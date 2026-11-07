// The member's job tracker and AI application manager: jobs they saved or applied to, where each one stands, its
// deadline, interview, recruiter contact and conversations, follow-ups and rejection reason, and the next step.
// Rolearch applications update their row automatically as the company moves them through its pipeline.
// Blueprint 7.2 lifecycle: saved = Interested, interviewing = Interview (stored names kept for existing rows).
export const TRACKER_STATUSES = ["saved", "analyzing", "ready", "applied", "screen", "interviewing", "offer", "rejected", "withdrawn", "archived"] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

export const REJECTION_REASONS = ["no_response", "skills_gap", "experience", "location", "salary", "position_filled", "after_interview", "other"] as const;
export type RejectionReason = (typeof REJECTION_REASONS)[number];

export const LOG_KINDS = ["email", "call", "message", "interview", "note"] as const;
/** "status" entries are written automatically on every status change, so the history is timestamped. */
export type LogEntry = { at: string; kind: (typeof LOG_KINDS)[number] | "status"; text: string };

export type TrackedJob = {
  jobId: string;
  status: TrackerStatus;
  title: string;
  company: string;
  url: string;
  notes: string;
  appliedAt: string | null;
  updatedAt: string;
  createdAt: string;
  deadline: string | null;
  interviewAt: string | null;
  followUpOn: string | null;
  contactName: string;
  contactEmail: string;
  rejectionReason: RejectionReason | "";
  log: LogEntry[];
  coverLetter: string;
};

/** A database row (select "*", so it reads before and after db/031 adds the manager columns). */
export function fromRow(r: Record<string, unknown>): TrackedJob {
  const s = (k: string) => (typeof r[k] === "string" ? (r[k] as string) : "");
  const n = (k: string) => (typeof r[k] === "string" && r[k] ? (r[k] as string) : null);
  const reason = s("rejection_reason");
  return {
    jobId: s("job_id"),
    status: s("status") as TrackerStatus,
    title: s("title"),
    company: s("company"),
    url: s("url"),
    notes: s("notes"),
    appliedAt: n("applied_at"),
    updatedAt: s("updated_at"),
    createdAt: s("created_at"),
    deadline: n("deadline"),
    interviewAt: n("interview_at"),
    followUpOn: n("follow_up_on"),
    contactName: s("contact_name"),
    contactEmail: s("contact_email"),
    rejectionReason: (REJECTION_REASONS as readonly string[]).includes(reason) ? (reason as RejectionReason) : "",
    log: Array.isArray(r.log) ? (r.log as LogEntry[]).filter((e) => e && typeof e.text === "string") : [],
    coverLetter: s("cover_letter"),
  };
}

export type NextStep = { id: string; values: Record<string, string | number>; urgent: boolean; href?: string };

const DAY = 86_400_000;
const days = (from: number, iso: string) => Math.floor((new Date(iso).getTime() - from) / DAY);

/** What to do next for one application, from its status and dates. `now` is passed in (ms) so this stays pure. */
export function nextStep(j: TrackedJob, now: number): NextStep | null {
  const d = (iso: string) => days(now, iso);
  if (j.status === "saved") {
    if (j.deadline && d(j.deadline) < 0) return { id: "deadlinePassed", values: {}, urgent: false };
    if (j.deadline && d(j.deadline) <= 3) return { id: "applySoon", values: { n: Math.max(0, d(j.deadline)) }, urgent: true, href: `/jobs/${j.jobId}#ats-h` };
    return { id: "checkFit", values: {}, urgent: false, href: `/jobs/${j.jobId}#ats-h` };
  }
  if (j.status === "analyzing") return { id: "finishFit", values: {}, urgent: false, href: `/jobs/${j.jobId}#ats-h` };
  if (j.status === "ready") {
    if (j.deadline && d(j.deadline) <= 3 && d(j.deadline) >= 0) return { id: "applySoon", values: { n: d(j.deadline) }, urgent: true, href: `/jobs/${j.jobId}` };
    return { id: "applyNow", values: {}, urgent: true, href: `/jobs/${j.jobId}` };
  }
  if (j.status === "screen") return { id: "prepareScreen", values: {}, urgent: true, href: `/interview?job=${encodeURIComponent(j.jobId)}` };
  if (j.status === "applied") {
    if (j.followUpOn && d(j.followUpOn) <= 0) return { id: "followUpToday", values: {}, urgent: true };
    const since = j.appliedAt ? -d(j.appliedAt) : 0;
    if (since >= 7 && !j.followUpOn && j.log.length === 0) return { id: "followUp", values: { n: since }, urgent: true };
    return { id: "waiting", values: { n: since }, urgent: false };
  }
  if (j.status === "interviewing") {
    if (j.interviewAt && d(j.interviewAt) >= 0) return { id: "prepare", values: { n: d(j.interviewAt) }, urgent: d(j.interviewAt) <= 2, href: `/interview?job=${encodeURIComponent(j.jobId)}` };
    if (j.interviewAt) return { id: "thankYou", values: {}, urgent: -d(j.interviewAt) <= 1 };
    return { id: "addInterview", values: {}, urgent: false };
  }
  if (j.status === "offer") return { id: "offer", values: {}, urgent: true };
  if (j.status === "rejected" && !j.rejectionReason) return { id: "logReason", values: {}, urgent: false };
  return null;
}

export type Funnel = {
  saved: number;
  applied: number;
  /** Applications the employer replied to: a screen, an interview, an offer, a logged conversation or a stated rejection. */
  responses: number;
  interviewing: number;
  offer: number;
  rejected: number;
  /** Interviews per application sent, as a whole percent (0 when nothing was sent). */
  interviewRate: number;
  offerRate: number;
  reasons: { reason: RejectionReason; n: number }[];
};

/** Application outcomes: how far applications get, and why they stop. Anything past "saved" counts as sent. */
export function funnel(jobs: TrackedJob[]): Funnel {
  const sent = jobs.filter((j) => j.appliedAt || ["applied", "screen", "interviewing", "offer", "rejected", "withdrawn"].includes(j.status));
  const interviewed = sent.filter((j) => j.status === "interviewing" || j.status === "offer" || j.interviewAt || j.rejectionReason === "after_interview");
  const offers = sent.filter((j) => j.status === "offer");
  const counts = new Map<RejectionReason, number>();
  for (const j of jobs) if (j.status === "rejected" && j.rejectionReason) counts.set(j.rejectionReason, (counts.get(j.rejectionReason) ?? 0) + 1);
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
  return {
    saved: jobs.filter((j) => j.status === "saved" || j.status === "analyzing" || j.status === "ready").length,
    applied: sent.length,
    responses: sent.filter(
      (j) =>
        interviewed.includes(j) ||
        j.status === "screen" ||
        j.status === "offer" ||
        j.log.some((e) => e.kind !== "status") ||
        (j.status === "rejected" && j.rejectionReason !== "" && j.rejectionReason !== "no_response"),
    ).length,
    interviewing: interviewed.length,
    offer: offers.length,
    rejected: jobs.filter((j) => j.status === "rejected").length,
    interviewRate: pct(interviewed.length, sent.length),
    offerRate: pct(offers.length, sent.length),
    reasons: [...counts].map(([reason, n]) => ({ reason, n })).sort((a, b) => b.n - a.n),
  };
}

/** The current time, for next steps (kept out of components so rendering stays pure). */
export const nowMs = () => Date.now();
