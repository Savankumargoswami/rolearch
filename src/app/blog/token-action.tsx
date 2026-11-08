"use client";

import { useState, useTransition } from "react";
import { confirmBlog, unsubscribeBlog } from "./actions";

/** A button, not an automatic action on page load: email link scanners open links, and must not confirm or unsubscribe. */
export function TokenAction({ token, kind }: { token: string; kind: "confirm" | "unsubscribe" }) {
  const [done, setDone] = useState<boolean | null>(null);
  const [pending, start] = useTransition();
  if (done)
    return (
      <p role="status" className="mt-6 font-medium">
        {kind === "confirm" ? "You're subscribed. New articles will arrive about every other day." : "You're unsubscribed. You won't get blog emails any more."}
      </p>
    );
  return (
    <div className="mt-6">
      <button
        type="button"
        disabled={pending || !token}
        onClick={() => start(async () => setDone(await (kind === "confirm" ? confirmBlog(token) : unsubscribeBlog(token))))}
        className="inline-flex min-h-11 cursor-pointer items-center rounded-full bg-ink px-5 font-medium text-paper hover:bg-ink-hover disabled:opacity-60"
      >
        {kind === "confirm" ? "Confirm my subscription" : "Unsubscribe"}
      </button>
      {done === false && <p className="mt-3 text-sm text-muted">That link didn&apos;t work. It may be old; subscribe again on the blog page.</p>}
    </div>
  );
}
