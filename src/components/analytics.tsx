"use client";

import { Analytics, type BeforeSendEvent } from "@vercel/analytics/next";

// Page-visit counts (Vercel Web Analytics: no cookies, visitors aren't identified). Query strings are dropped before
// anything is sent, so tokens in confirm and unsubscribe links never leave the page; only the utm_* campaign tags are
// kept, which is how each source we share links in (newsletter, blog email, outreach, share cards) shows up.
function clean(event: BeforeSendEvent): BeforeSendEvent | null {
  const url = new URL(event.url);
  const keep = new URLSearchParams();
  for (const [k, v] of url.searchParams) if (/^utm_(source|medium|campaign|content)$/.test(k)) keep.set(k, v.slice(0, 60));
  url.search = keep.toString();
  url.hash = "";
  return { ...event, url: url.toString() };
}

export function SiteAnalytics() {
  return <Analytics beforeSend={clean} />;
}
