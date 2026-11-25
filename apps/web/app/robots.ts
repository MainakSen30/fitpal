import type { MetadataRoute } from "next";
import { headers } from "next/headers";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host")?.split(",")[0].trim() ?? requestHeaders.get("host") ?? "localhost:3001";
  const protocol = requestHeaders.get("x-forwarded-proto")?.split(",")[0].trim() ?? "http";

  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${protocol}://${host}/sitemap.xml`,
  };
}
