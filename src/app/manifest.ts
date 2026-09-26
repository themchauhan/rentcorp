import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_NAME, THEME_COLOR } from "@/lib/app";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "en-IN",
    categories: ["business", "productivity"],
    background_color: "#fafaf9",
    theme_color: THEME_COLOR,
    // Long-press the home-screen icon for these.
    shortcuts: [
      { name: "New booking", short_name: "New booking", url: "/bookings/new" },
      { name: "Bookings", url: "/bookings" },
    ],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
