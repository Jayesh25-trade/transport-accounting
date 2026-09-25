import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
