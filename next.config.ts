import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // Ship the built-in catalog with the server code.
  outputFileTracingIncludes: { "/**": ["./data/**/*"] },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" }, // admin image uploads
  },
};

export default nextConfig;
