import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Aceternity's static noise texture used by components/ui/noise-background
    remotePatterns: [{ protocol: "https", hostname: "assets.aceternity.com" }],
  },
};

export default nextConfig;
