"use client";

import { useSyncExternalStore } from "react";

const noop = () => () => {};

/**
 * A date and time in the viewer's own time zone. Server-rendered pages would otherwise show the server's zone
 * (UTC on Vercel) without saying so. Before hydration it shows UTC, labelled.
 */
export function LocalTime({ iso, options }: { iso: string; options?: Intl.DateTimeFormatOptions }) {
  const opts: Intl.DateTimeFormatOptions = { weekday: "short", hour: "numeric", minute: "2-digit", timeZoneName: "short", ...options };
  const text = useSyncExternalStore(
    noop,
    () => new Date(iso).toLocaleString("en-US", opts),
    () => new Date(iso).toLocaleString("en-US", { ...opts, timeZone: "UTC" }),
  );
  return <time dateTime={iso}>{text}</time>;
}
