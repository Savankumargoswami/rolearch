import type { NextConfig } from "next";

// Profile photos live in Supabase Storage's public avatars bucket; Next.js resizes and compresses them.
const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname : "";

const nextConfig: NextConfig = {
  /* config options here */
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
