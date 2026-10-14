import type { Region } from "@/data/types";

// Region choices for search. Kept apart from search.ts so the hero form doesn't pull in the job index.
export type Where = "anywhere" | "remote" | Region;
export const whereOptions: Where[] = [
  "anywhere",
  "remote",
  "europe",
  "north-america",
  "latin-america",
  "asia-pacific",
  "india",
  "middle-east-africa",
];
