import type { NextRequest } from "next/server";
import { once } from "@/lib/job-runs";
import { dataKey } from "@/lib/supabase/data-key";
import { supabaseUrl } from "@/lib/supabase/server";
import { METROS, ROLES, SPECIAL } from "@/lib/seo-pages";

// Vercel Schedules call this once a day (vercel.json) with "Authorization: Bearer $CRON_SECRET". It writes one row
// per role page (role x place, the same pages as the sitemap) into role_listings (db/054) with that page's search;
// a database schedule then fills in and refreshes each page's jobs. Only the search columns are written, so saved
// jobs stay; pages no longer on the site are removed.

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  return once("role-listings", "day", request, async () => {
    const rows = ROLES.flatMap((r) =>
      [undefined, ...SPECIAL, ...METROS].map((p) => ({
        role_slug: r.slug,
        place_slug: p?.slug ?? "",
        q: r.q,
        remote_only: p?.kind === "remote",
        visa_only: p?.kind === "visa",
        near_lat: p?.kind === "metro" ? p.lat : null,
        near_lon: p?.kind === "metro" ? p.lon : null,
      })),
    );
    const headers = { apikey: dataKey, "Content-Type": "application/json" };
    const up = await fetch(`${supabaseUrl}/rest/v1/role_listings?on_conflict=role_slug,place_slug`, {
      method: "POST",
      headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(rows),
      cache: "no-store",
    });
    if (!up.ok) return Response.json({ error: `role_listings upsert failed: ${up.status} ${(await up.text()).slice(0, 200)}` }, { status: 502 });

    // Remove pages that were dropped from the site (a role or city taken off the list).
    const keep = new Set(rows.map((r) => `${r.role_slug}/${r.place_slug}`));
    const have = await fetch(`${supabaseUrl}/rest/v1/role_listings?select=role_slug,place_slug`, { headers, cache: "no-store" });
    const stale = have.ok ? ((await have.json()) as { role_slug: string; place_slug: string }[]).filter((r) => !keep.has(`${r.role_slug}/${r.place_slug}`)) : [];
    for (const r of stale) {
      await fetch(`${supabaseUrl}/rest/v1/role_listings?role_slug=eq.${encodeURIComponent(r.role_slug)}&place_slug=eq.${encodeURIComponent(r.place_slug)}`, {
        method: "DELETE",
        headers,
        cache: "no-store",
      });
    }
    return Response.json({ ok: true, pages: rows.length, removed: stale.length });
  });
}
