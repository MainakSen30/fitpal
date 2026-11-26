import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const origin = "https://fitpal.io";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
    },
    sitemap: `${origin}/sitemap.xml`,
  };
}
