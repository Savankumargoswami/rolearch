import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Rolearch",
    short_name: "Rolearch",
    description: "One network, endless opportunity.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f5f1",
    theme_color: "#0e1f2f",
    icons: [
      { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
      { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
