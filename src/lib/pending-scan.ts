// A visitor's free scan, held in this browser (IndexedDB keeps the resume file itself) while they create their
// account; it runs as soon as they're signed in, then is deleted. Nothing is sent to us until then.
import type { AtsTarget } from "@/app/ats/actions";

export type PendingScan = { key: string; target: AtsTarget; file: File; at: number };

const DB = "rolearch";
const STORE = "pending-scan";
const MAX_AGE = 24 * 3600_000;

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const req = fn(db.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function savePending(scan: Omit<PendingScan, "at">): Promise<boolean> {
  try {
    await run("readwrite", (s) => s.put({ ...scan, at: Date.now() }, "scan"));
    return true;
  } catch {
    return false;
  }
}

/** The waiting scan for this page (by key), removed as it's taken. */
export async function takePending(key: string): Promise<PendingScan | null> {
  try {
    const scan = (await run("readonly", (s) => s.get("scan"))) as PendingScan | undefined;
    if (!scan || scan.key !== key) return null;
    await run("readwrite", (s) => s.delete("scan"));
    return Date.now() - scan.at < MAX_AGE ? scan : null;
  } catch {
    return null;
  }
}
