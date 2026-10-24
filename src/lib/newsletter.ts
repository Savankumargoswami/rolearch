// The weekly newsletter's one-click unsubscribe, shared by the email header endpoint and the unsubscribe page.
import "server-only";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function unsubscribe(token: string) {
  if (!URL_ || !KEY || !UUID.test(token)) return false;
  const res = await fetch(`${URL_}/rest/v1/rpc/newsletter_unsubscribe`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
    cache: "no-store",
  });
  return res.ok && (await res.json()) === true;
}
