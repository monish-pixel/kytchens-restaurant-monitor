import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Revalidate all pages every 60s (match scrape cadence)
  experimental: {},
};

export default nextConfig;
