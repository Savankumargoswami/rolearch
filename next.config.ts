import type { NextConfig } from "next";

// Profile photos live in Supabase Storage's public avatars bucket; Next.js resizes and compresses them.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "";

// Security headers on every response. The site is never framed (clickjacking), always HTTPS, content types are
// never guessed, referrers carry only the origin to other sites, and only the camera is allowed (by this site
// itself) for proctored skill tests; microphone, location and the rest are off.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; object-src 'none'; base-uri 'self'; upgrade-insecure-requests" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  cacheComponents: true,
  partialPrefetching: true,
  images: {
    remotePatterns: supabaseHost
      ? [
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/avatars/**" },
          { protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/post-images/**" },
        ]
      : [],
  },
  experimental: {
    // Uploads go through Server Actions: a 5 MB resume, or a post with up to four 2 MB images, plus multipart overhead.
    serverActions: { bodySizeLimit: "9mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
