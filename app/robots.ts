import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/cart", "/checkout", "/order", "/pay", "/account", "/review", "/wishlist", "/ar/cart", "/ar/checkout", "/ar/order", "/ar/account", "/ar/review", "/ar/wishlist", "/fr/cart", "/fr/checkout", "/fr/order", "/fr/account", "/fr/review", "/fr/wishlist", "/*?*sort=", "/*?*page=", "/*?*min=", "/*?*max="] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
