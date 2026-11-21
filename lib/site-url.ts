// The shop's public address. Override with NEXT_PUBLIC_SITE_URL in Vercel if it ever changes.
export const DEFAULT_SITE_URL = "https://shopsuperyou.com";
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
