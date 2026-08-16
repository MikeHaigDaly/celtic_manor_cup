import type { MetadataRoute } from "next";
import { TOURNAMENT } from "@/config/tournament";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${TOURNAMENT.name} — ${TOURNAMENT.subtitle}`,
    short_name: TOURNAMENT.name,
    description: `${TOURNAMENT.name} — ${TOURNAMENT.year}`,
    start_url: "/",
    display: "standalone",
    background_color: "#F7F3EC",
    theme_color: "#F7F3EC",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
