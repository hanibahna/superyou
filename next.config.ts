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
      // Social post images: readable by Facebook / Instagram composers when uploading.
      source: "/fb/:path*",
      headers: [{ key: "Access-Control-Allow-Origin", value: "*" }],
    }, {
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "X-Frame-Options", value: "SAMEORIGIN" },
        // Content Security Policy in report-only mode: nothing is blocked yet; browsers report what
        // would be, to /api/csp-report/ (see Admin → My sign-in security). Switch to enforcing once clean.
        { key: "Content-Security-Policy-Report-Only", value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://analytics.tiktok.com https://sc-static.net https://va.vercel-scripts.com https://vercel.live; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' data: https://fonts.gstatic.com; img-src 'self' data: blob: https:; media-src 'self' blob: https:; connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://*.facebook.com https://*.facebook.net https://analytics.tiktok.com https://*.snapchat.com https://vitals.vercel-insights.com https://vercel.live wss://*.daily.co https://*.daily.co https://*.whereby.com; frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.tiktok.com https://player.vimeo.com https://*.daily.co https://*.whereby.com https://epayment.areeba.com https://www.facebook.com https://vercel.live https://td.doubleclick.net https://www.googletagmanager.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self' https://epayment.areeba.com; frame-ancestors 'self'; report-uri /api/csp-report/" },
        { key: "Permissions-Policy", value: 'camera=(self "https://*.daily.co" "https://*.whereby.com"), microphone=(self "https://*.daily.co" "https://*.whereby.com"), display-capture=(self "https://*.daily.co" "https://*.whereby.com"), geolocation=(self), payment=(self)' },
      ],
    }];
  },
  experimental: {
    serverActions: { bodySizeLimit: "8mb" }, // admin image uploads
  },
};

export default nextConfig;
