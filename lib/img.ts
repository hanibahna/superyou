/** Ask image CDNs that support resizing for a smaller file (Shopify CDN: ?width=). */
export function imgUrl(src: string | undefined, width: number): string | undefined {
  if (!src) return src;
  if (/^https:\/\/(cdn\.shopify\.com|[^/]+\/cdn\/shop)\//.test(src)) {
    const u = new URL(src);
    u.searchParams.set("width", String(width));
    return u.toString();
  }
  return src;
}
