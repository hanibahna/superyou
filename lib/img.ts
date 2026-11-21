// Product photos. Photos from the suppliers' image servers are served from SuperYou's own address
// (/img/<code>.jpg), so their file names (which carry the supplier's name) never reach customers.

const SHOPIFY_FILES = "https://cdn.shopify.com/s/files/";

const b64 = (s: string) =>
  typeof Buffer !== "undefined" ? Buffer.from(s).toString("base64url") : btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/** Storefront address for a product photo. */
export function shopImg(src: string | undefined): string | undefined {
  if (!src || !src.startsWith(SHOPIFY_FILES)) return src;
  const u = new URL(src);
  const path = u.pathname.slice("/s/files/".length);
  const ext = /\.(png|webp|gif|jpe?g)$/i.exec(path)?.[1]?.toLowerCase().replace("jpeg", "jpg") ?? "jpg";
  return `/img/${b64(path)}.${ext}`;
}

/** The supplier image address behind a /img/… code (server only). */
export function imgSource(code: string): string | null {
  const m = /^([A-Za-z0-9_-]+)\.(png|webp|gif|jpg)$/.exec(code);
  if (!m) return null;
  const path = Buffer.from(m[1], "base64url").toString();
  if (!/^[\w\-./%]+$/.test(path) || path.includes("..")) return null;
  return SHOPIFY_FILES + path;
}

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

/** Same, for every picture field (image, poster, images…) inside homepage sections and categories. */
export function shopImgDeep<T>(v: T): T {
  if (Array.isArray(v)) return v.map((x) => shopImgDeep(x)) as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, x] of Object.entries(v as Record<string, unknown>)) {
      out[k] = typeof x === "string" && /^(image|poster|logo|banner)$/i.test(k) ? shopImg(x) : k === "images" && Array.isArray(x) ? x.map((y) => (typeof y === "string" ? shopImg(y) : shopImgDeep(y))) : shopImgDeep(x);
    }
    return out as T;
  }
  return v;
}
