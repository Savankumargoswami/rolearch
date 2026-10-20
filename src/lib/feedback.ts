// The features members can say they like or don't, for the feedback form and the weekly digest.
export const FEATURES = [
  { id: "search", label: "Job search and filters" },
  { id: "match", label: "Match score and missing skills" },
  { id: "learning", label: "Free learning links" },
  { id: "ats", label: "ATS resume check" },
  { id: "tailor", label: "Resume tailoring" },
  { id: "profile", label: "Profile and resume builder" },
  { id: "tracker", label: "Job tracker" },
  { id: "apply", label: "Apply with your Rolearch profile" },
  { id: "posts", label: "Posts feed" },
  { id: "hiring", label: "Hiring dashboard (companies)" },
] as const;

export type FeatureId = (typeof FEATURES)[number]["id"];
export const FEATURE_IDS: readonly string[] = FEATURES.map((f) => f.id);
export const featureLabel = (id: string) => FEATURES.find((f) => f.id === id)?.label ?? id;
