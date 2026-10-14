import { jobIndex as jobs } from "@/data/jobs-index";
import type { JobLite as Job, Level } from "@/data/types";
import { whereOptions, type Where } from "./regions";

export { whereOptions, type Where };
import { matchJob } from "./match";

export type Filters = {
  q: string;
  where: Where;
  remote: boolean;
  visa: boolean;
  pay: boolean;
  level: Level | "any";
  sort: "match" | "newest";
};

export const emptyFilters: Filters = { q: "", where: "anywhere", remote: false, visa: false, pay: false, level: "any", sort: "match" };

const fold = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function haystack(job: Job) {
  return fold([job.title, job.company, job.city, job.country, ...job.skills].join(" "));
}

export function filterJobs(f: Filters): Job[] {
  const tokens = fold(f.q).split(/\s+/).filter(Boolean);
  const out = jobs.filter((job) => {
    if (tokens.length && !tokens.every((tok) => haystack(job).includes(tok))) return false;
    if (f.where === "remote" && job.workplace !== "remote") return false;
    if (f.where !== "anywhere" && f.where !== "remote" && job.region !== f.where) return false;
    if (f.remote && job.workplace !== "remote") return false;
    if (f.visa && !job.visa) return false;
    if (f.pay && !job.salary) return false;
    if (f.level !== "any" && job.level !== f.level) return false;
    return true;
  });
  if (f.sort === "newest") return out.sort((a, b) => a.postedDaysAgo - b.postedDaysAgo);
  const score = new Map(out.map((j) => [j.id, matchJob(j).score]));
  return out.sort((a, b) => score.get(b.id)! - score.get(a.id)! || a.postedDaysAgo - b.postedDaysAgo);
}

export function parseFilters(sp: URLSearchParams): Filters {
  const where = sp.get("where") as Where | null;
  const level = sp.get("level") as Filters["level"] | null;
  return {
    q: sp.get("q") ?? "",
    where: where && whereOptions.includes(where) ? where : "anywhere",
    remote: sp.get("remote") === "1",
    visa: sp.get("visa") === "1",
    pay: sp.get("pay") === "1",
    level: level && ["entry", "mid", "senior", "lead"].includes(level) ? level : "any",
    sort: sp.get("sort") === "newest" ? "newest" : "match",
  };
}

export function filtersToQuery(f: Filters): string {
  const sp = new URLSearchParams();
  if (f.q) sp.set("q", f.q);
  if (f.where !== "anywhere") sp.set("where", f.where);
  if (f.remote) sp.set("remote", "1");
  if (f.visa) sp.set("visa", "1");
  if (f.pay) sp.set("pay", "1");
  if (f.level !== "any") sp.set("level", f.level);
  if (f.sort !== "match") sp.set("sort", f.sort);
  const s = sp.toString();
  return s ? `?${s}` : "";
}
