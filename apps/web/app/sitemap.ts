import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const origin = "https://fitpal.io";

const routes = [
  "",
  "/features/workout-logging",
  "/features/routines",
  "/features/logbook",
  "/features/progress",
  "/features/rest-timer",
  "/features/offline-sync",
];

export default function sitemap(): MetadataRoute.Sitemap {
  return routes.map((route, index) => ({
    url: `${origin}${route}`,
    lastModified: new Date(),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
