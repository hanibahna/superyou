import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  trailingSlash: true,
  // Ship the built-in catalog with the server code.
  outputFileTracingIncludes: { "/**": ["./data/**/*"], "/opengraph-image": ["./public/brand/**/*"] },
  // Security headers on every page. Camera/mic are allowed for our video-call providers only.
  async redirects() {
    // Short, shareable name for the 3D AI skin scan; keeps the share tracking (?utm_source=…).
    return [{ source: "/superscan", destination: "/skin-scan/", permanent: false }, { source: "/superscan/", destination: "/skin-scan/", permanent: false }];
  },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        { key: "Permissions-Policy", value: 'camera=(self "https://*.daily.co" "https://*.whereby.com"), microphone=(self "https://*.daily.co" "https://*.whereby.com"), display-capture=(self "https://*.daily.co" "https://*.whereby.com"), geolocation=(self), payment=(self)' },
      ],
    }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" }, // admin image uploads
  },
};

export default nextConfig;
