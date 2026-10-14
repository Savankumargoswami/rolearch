export type Region =
  | "europe"
  | "north-america"
  | "latin-america"
  | "asia-pacific"
  | "india"
  | "middle-east-africa"
  | "global"; // remote, open worldwide

export type Workplace = "remote" | "hybrid" | "onsite";
export type Level = "entry" | "mid" | "senior" | "lead";
export type Salary = { min: number; max: number; currency: string; period: "year" | "month" | "hour" };

/** What the search page needs in the browser. */
export type JobLite = {
  id: string;
  title: string;
  company: string;
  city: string; // "Berlin", or "Remote"
  country: string; // country name, or the remote scope ("United Kingdom", "Worldwide")
  region: Region;
  workplace: Workplace;
  visa: boolean;
  salary: Salary | null;
  level: Level;
  years: number;
  skills: string[];
  postedDaysAgo: number;
};

/** The full record, read on the server for job pages. */
export type Job = JobLite & {
  nice: string[];
  source: string;
  summary: string;
  duties: string[];
  postedAt?: string;
  countryCode?: string | null;
  jobUrl?: string; // the job's page on the company's careers site
  applyUrl?: string; // where Apply sends the person
  lat?: number | null;
  lon?: number | null;
};
