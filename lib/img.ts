// Product photos. Photos from the suppliers' image servers are served from SuperYou's own address
// (/img/<code>.jpg), so their file names (which carry the supplier's name) never reach customers.

/** Ask for a smaller file: works for SuperYou's /img/ addresses and image CDNs that resize (Shopify: ?width=). */
export function imgUrl(src: string | undefined, width: number): string | undefined {
  if (!src) return src;
  if (src.startsWith("/img/")) return `${src.split("?")[0]}?w=${width}`;
  if (/^https:\/\/(cdn\.shopify\.com|[^/]+\/cdn\/shop)\//.test(src)) {
    const u = new URL(src);
    u.searchParams.set("width", String(width));
    return u.toString();
  }
  return src;
}

/** The original file, for copying photos (admin re-host). */
export function rawImgUrl(src: string | undefined, width: number): string | undefined {
  if (!src || !/^https:\/\//.test(src)) return src;
  return imgUrl(src, width);
}

