"use server";

import { revalidatePath, updateTag } from "next/cache";
import { t } from "@/i18n";
import { checkFeed } from "@/lib/feed-check";
import { STAGES, type Question } from "@/lib/hiring";
import { reviewJob, type JobDraft } from "@/lib/job-review";
import { loadViewer } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

export type HireResult = { ok: true; id?: string } | { ok: false; rejected?: boolean; message: string };

const WORKPLACES = ["remote", "hybrid", "onsite"] as const;
const EMPLOYMENT = ["full_time", "part_time", "contract", "temporary", "internship"] as const;
const PERIODS = ["year", "month", "hour"] as const;

async function company() {
  const viewer = await loadViewer();
  if (!viewer) return { error: t("profile.errSignedOut") } as const;
  if (viewer.accountType !== "company") return { error: t("hire.errNotCompany") } as const;
  return { viewer, db: await createClient() } as const;
}

function num(v: FormDataEntryValue | null): number | null {
  const n = Number(String(v ?? "").replace(/[, ]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Reviews a job with Claude and, if it's a genuine job, publishes it straight to search. */
export async function postJob(form: FormData): Promise<HireResult> {
  const c = await company();
  if ("error" in c) return { ok: false, message: c.error! };
  if (!c.viewer.companyDomainMatches) return { ok: false, message: t("hire.errUnverified") };

  const title = String(form.get("title") ?? "").trim();
  const location = String(form.get("location") ?? "").trim();
  const workplace = String(form.get("workplace") ?? "onsite") as (typeof WORKPLACES)[number];
  const employment = String(form.get("employment") ?? "full_time") as (typeof EMPLOYMENT)[number];
  const description = String(form.get("description") ?? "").trim();
  const skills = String(form.get("skills") ?? "").trim();
  const min = num(form.get("salaryMin"));
  const max = num(form.get("salaryMax")) ?? min;
  const currency = String(form.get("currency") ?? "").trim().toUpperCase();
  const period = String(form.get("period") ?? "year") as (typeof PERIODS)[number];
  const visa = form.get("visa") === "on";

  if (title.length < 3 || title.length > 160) return { ok: false, message: t("hire.errTitle") };
  if (!WORKPLACES.includes(workplace) || !EMPLOYMENT.includes(employment) || !PERIODS.includes(period)) return { ok: false, message: t("hire.errForm") };
  if (workplace !== "remote" && location.length < 2) return { ok: false, message: t("hire.errLocation") };
  if (description.length < 200) return { ok: false, message: t("hire.errDescriptionShort") };
  if (description.length > 20000) return { ok: false, message: t("hire.errDescriptionLong") };
  if (min && (!/^[A-Z]{3}$/.test(currency) || (max ?? 0) < min)) return { ok: false, message: t("hire.errSalary") };

  let questions: Question[] = [];
  try {
    const raw = JSON.parse(String(form.get("questions") ?? "[]")) as Question[];
    questions = raw
      .filter((q) => q && typeof q.q === "string" && q.q.trim())
      .slice(0, 5)
      .map((q) => ({ q: q.q.trim().slice(0, 200), kind: q.kind === "yesno" ? "yesno" : "text", required: Boolean(q.required) }));
  } catch {
    return { ok: false, message: t("hire.errForm") };
  }

  const draft: JobDraft = {
    title,
    location: workplace === "remote" && !location ? "Remote" : location,
    workplace,
    employment,
    description,
    skills,
    salary: min ? `${min}-${max} ${currency} per ${period}` : "",
  };
  const review = await reviewJob(draft);
  if ("error" in review) return { ok: false, message: review.error === "unavailable" ? t("hire.errReviewOff") : t("hire.errReview") };
  if (!review.allowed) return { ok: false, rejected: true, message: review.reason };

  const f = review.facts;
  const listed = skills.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
  const { data, error } = await c.db.rpc("post_job", {
    p_secret: process.env.POST_REVIEW_SECRET,
    p_title: title,
    p_city: workplace === "remote" && !f.city ? "Remote" : f.city,
    p_country: f.country,
    p_country_code: f.countryCode,
    p_region: f.region,
    p_workplace: workplace,
    p_employment: employment,
    p_level: f.level,
    p_years: f.years,
    p_skills: [...new Set([...listed, ...f.skills])].slice(0, 15),
    p_category: f.category,
    p_summary: f.summary,
    p_description: description,
    p_salary_min: min,
    p_salary_max: min ? max : null,
    p_currency: min ? currency : null,
    p_period: min ? period : null,
    p_visa: visa,
    p_questions: questions,
  });
  if (error) {
    console.error("[hire] post failed:", error.message);
    return { ok: false, message: t("hire.errSave") };
  }
  updateTag("jobs");
  revalidatePath("/hire");
  return { ok: true, id: data as string };
}

export async function setJobStatus(jobId: string, status: "open" | "closed"): Promise<HireResult> {
  const c = await company();
  if ("error" in c) return { ok: false, message: c.error! };
  const { error } = await c.db.rpc("set_job_status", { p_job: jobId, p_status: status });
  if (error) return { ok: false, message: t("hire.errSave") };
  updateTag("jobs");
  revalidatePath("/hire");
  revalidatePath(`/hire/jobs/${jobId}`);
  return { ok: true };
}

export async function moveApplicant(appId: string, stage: string, message = ""): Promise<HireResult> {
  const c = await company();
  if ("error" in c) return { ok: false, message: c.error! };
  if (!(STAGES as readonly string[]).includes(stage)) return { ok: false, message: t("hire.errForm") };
  const { error } = await c.db.rpc("set_application_stage", { p_app: appId, p_stage: stage, p_message: message.trim().slice(0, 4000) });
  if (error) return { ok: false, message: error.message.includes("withdrew") ? t("hire.errWithdrawn") : t("hire.errSave") };
  revalidatePath("/hire", "layout");
  return { ok: true };
}

export type FeedResult = { ok: true; count: number } | { ok: false; message: string };

/** Checks a job feed (public https, a readable job format) and connects it; the next refresh brings its jobs in. */
export async function connectFeed(_: FeedResult | null, form: FormData): Promise<FeedResult> {
  const c = await company();
  if ("error" in c) return { ok: false, message: c.error! };
  if (!c.viewer.companyDomainMatches) return { ok: false, message: t("hire.errUnverified") };
  const url = String(form.get("url") ?? "").trim().slice(0, 2000);
  const check = await checkFeed(url);
  if (!check.ok) return { ok: false, message: t(`hire.feedErr_${check.reason}`) };
  const { error } = await c.db.rpc("add_employer_feed", { p_url: url, p_count: check.count });
  if (error) return { ok: false, message: error.message.includes("limit") ? t("hire.feedErr_limit") : t("hire.errSave") };
  revalidatePath("/hire");
  return { ok: true, count: check.count };
}

/** Disconnects a feed and closes the jobs that came from it. */
export async function removeFeed(id: string): Promise<HireResult> {
  const c = await company();
  if ("error" in c) return { ok: false, message: c.error! };
  const { error } = await c.db.rpc("remove_employer_feed", { p_id: id });
  if (error) return { ok: false, message: t("hire.errSave") };
  updateTag("jobs");
  revalidatePath("/hire");
  return { ok: true };
}

export async function addApplicantEvent(appId: string, kind: "note" | "message", body: string): Promise<HireResult> {
  const c = await company();
  if ("error" in c) return { ok: false, message: c.error! };
  if (!body.trim()) return { ok: false, message: t("hire.errEmpty") };
  const { error } = await c.db.rpc("add_application_event", { p_app: appId, p_kind: kind, p_body: body.trim().slice(0, 4000) });
  if (error) return { ok: false, message: t("hire.errSave") };
  revalidatePath(`/hire/applications/${appId}`);
  return { ok: true };
}
