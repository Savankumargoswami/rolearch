// Campaign tags on links we send out (emails, outreach, share cards), so the analytics show which channel each visit
// came from. Unsubscribe and confirm links are left untouched.

/** Adds utm_source/medium/campaign to one URL (absolute or site-relative). */
export function utm(url: string, source: string, medium: string, campaign: string): string {
  const [base, hash = ""] = url.split("#");
  const sep = base.includes("?") ? "&" : "?";
  const tags = `utm_source=${encodeURIComponent(source)}&utm_medium=${encodeURIComponent(medium)}&utm_campaign=${encodeURIComponent(campaign)}`;
  return `${base}${sep}${tags}${hash ? `#${hash}` : ""}`;
}

/** Tags every rolearch.com link in an email's HTML, except unsubscribe and confirm links. */
export function tagEmailLinks(html: string, source: string, campaign: string): string {
  return html.replace(/href="(https:\/\/www\.rolearch\.com[^"]*)"/g, (m, url: string) =>
    /unsubscribe|\/confirm|__TOKEN__/.test(url) ? m : `href="${utm(url.replaceAll("&amp;", "&"), source, "email", campaign).replaceAll("&", "&amp;")}"`,
  );
}
