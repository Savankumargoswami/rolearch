"use server";

import { memberRoadmap, type Roadmap } from "@/lib/roadmaps";
import { loadViewer } from "@/lib/profile";

/** The roadmap for the protected viewer: fetched after the page loads, so it isn't in the page's HTML. */
export async function loadRoadmap(slug: string): Promise<Roadmap | null> {
  if (!(await loadViewer())) return null;
  return memberRoadmap(slug);
}
