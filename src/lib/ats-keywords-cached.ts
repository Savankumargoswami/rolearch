// A job's scanner keywords, read once per job and kept, so every member checking the same job is scored
// against the same list (and we pay for the read once).
import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { readAtsKeywords, type AtsKeywords } from "./ats-keywords";

async function cached(id: string, title: string, description: string): Promise<AtsKeywords> {
  "use cache";
  cacheLife("weeks");
  cacheTag(`ats-keywords-${id}`);
  const kw = await readAtsKeywords(title, description);
  // Throwing keeps a failed read out of the cache; the next check tries again.
  if (!kw) throw new Error("keywords unavailable");
  return kw;
}

export async function jobAtsKeywords(id: string, title: string, description: string): Promise<AtsKeywords | null> {
  try {
    return await cached(id, title, description);
  } catch {
    return null;
  }
}
