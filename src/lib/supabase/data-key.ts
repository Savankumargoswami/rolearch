import "server-only";

/**
 * The key the server uses for job data, search, sitemaps, roadmaps and the secret-guarded maintenance functions.
 * It's the service role key (never sent to the browser), so the public anon key can be denied direct access to the
 * jobs table and those functions (db/037): nobody can page through the whole job database from outside the site.
 * Falls back to the anon key only until SUPABASE_SERVICE_ROLE_KEY is set.
 */
export const dataKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
