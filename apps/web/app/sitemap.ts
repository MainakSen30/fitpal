import type { MetadataRoute } from "next";
import { headers } from "next/headers";

const routes = [
  "",
  "/features/workout-logging",
  "/features/routines",
  "/features/logbook",
  "/features/progress",
  "/features/rest-timer",
  "/features/offline-sync",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ?? requestHeaders.get("host") ?? "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http";
  const origin = `${protocol}://${host}`;

  return routes.map((route, index) => ({
    url: `${origin}${route}`,
    lastModified: new Date(),
    changeFrequency: index === 0 ? "weekly" : "monthly",
    priority: index === 0 ? 1 : 0.7,
  }));
}
