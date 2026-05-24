import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@samu-cru/shared", "@samu-cru/db"],
  experimental: {
    typedRoutes: true,
  },
};

export default nextConfig;
