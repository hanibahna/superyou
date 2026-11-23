import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

// Search engines and AI assistants (ChatGPT, Claude, Perplexity, Gemini, Copilot…) may read every
// shop page; private pages (account, checkout, orders, saved scans, subscriptions) and filter
// combinations stay out. AI assistants also get a plain-text guide at /llms.txt.
const PRIVATE = ["/admin", "/api/", "/cart", "/checkout", "/order", "/pay", "/account", "/review", "/wishlist", "/subscription", "/skin-scan/r/", "/call/", "/site-lock"];
const disallow = [...PRIVATE, ...PRIVATE.filter((p) => !p.startsWith("/api") && !p.startsWith("/admin")).flatMap((p) => [`/ar${p}`, `/fr${p}`]), "/*?*sort=", "/*?*page=", "/*?*min=", "/*?*max="];
const AI = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-User", "Claude-SearchBot", "PerplexityBot", "Perplexity-User", "Google-Extended", "Applebot-Extended", "Bingbot", "CCBot", "meta-externalagent", "Amazonbot", "DuckAssistBot", "MistralAI-User"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow }, { userAgent: AI, allow: ["/", "/llms.txt", "/llms-full.txt"], disallow }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
