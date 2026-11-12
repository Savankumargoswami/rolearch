// Session cookie flags for every Supabase client. The app only talks to Supabase from the server (server components,
// actions and the proxy), so the browser never needs to read the session: HttpOnly keeps scripts away from it, and
// Secure keeps it on HTTPS (browsers also accept Secure cookies on http://localhost, so local runs still work).
export const sessionCookieOptions = { httpOnly: true, secure: true, sameSite: "lax", path: "/" } as const;
