// The member's job tracker: jobs they saved or applied to, with where each one stands.
// Rolearch applications update their row automatically as the company moves them through its pipeline.
export const TRACKER_STATUSES = ["saved", "applied", "interviewing", "offer", "rejected", "archived"] as const;
export type TrackerStatus = (typeof TRACKER_STATUSES)[number];

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
};
