// The shop's public address. Override with NEXT_PUBLIC_SITE_URL in Vercel if it ever changes.
export const DEFAULT_SITE_URL = "https://www.shopsuperyou.com"; // www is the main address (the bare domain redirects to it)
export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
