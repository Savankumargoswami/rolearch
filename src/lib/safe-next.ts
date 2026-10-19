/** A same-site path to send someone back to after signing in, or the fallback. Blocks "//host" and "/\host" tricks. */
export function safeNext(value: unknown, fallback = "/account"): string {
  const v = typeof value === "string" ? value.trim() : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") && v.length <= 500 ? v : fallback;
}
