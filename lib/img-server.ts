import "server-only";

import { createCipheriv, createDecipheriv, createHash, createHmac } from "node:crypto";

// Product photos from suppliers' image servers are served from SuperYou's own address (/img/<code>.jpg).
// The code is encrypted with a server-only key, so the original file name (which can carry a supplier's
// name) can't be read back from the address.
const SHOPIFY_FILES = "https://cdn.shopify.com/s/files/";
const secret = process.env.IMG_SECRET || process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || process.env.ADMIN_PASSWORD || "superyou-img";
const KEY = createHash("sha256").update(`img:${secret}`).digest();
const MAC = createHash("sha256").update(`mac:${secret}`).digest();

function encode(path: string) {
  const iv = createHmac("sha256", MAC).update(path).digest().subarray(0, 16); // same photo → same address (cacheable)
  const c = createCipheriv("aes-256-ctr", KEY, iv);
  return Buffer.concat([iv, c.update(path, "utf8"), c.final()]).toString("base64url");
}
function decode(code: string): string | null {
  const buf = Buffer.from(code, "base64url");
  if (buf.length < 17) return null;
  const iv = buf.subarray(0, 16);
  const d = createDecipheriv("aes-256-ctr", KEY, iv);
  const path = Buffer.concat([d.update(buf.subarray(16)), d.final()]).toString("utf8");
  // Only addresses we issued: the iv is the path's keyed hash.
  return createHmac("sha256", MAC).update(path).digest().subarray(0, 16).equals(iv) ? path : null;
}

/** Storefront address for a product photo. */
export function shopImg(src: string | undefined): string | undefined {
  if (!src || !src.startsWith(SHOPIFY_FILES)) return src;
  const u = new URL(src);
  const path = u.pathname.slice("/s/files/".length);
  const ext = /\.(png|webp|gif|jpe?g)$/i.exec(path)?.[1]?.toLowerCase().replace("jpeg", "jpg") ?? "jpg";
  return `/img/${encode(path)}.${ext}`;
}

/** The supplier image address behind a /img/… code. */
export function imgSource(code: string): string | null {
  const m = /^([A-Za-z0-9_-]+)\.(png|webp|gif|jpg)$/.exec(code);
  if (!m) return null;
  const path = decode(m[1]);
  if (!path || !/^[\w\-./%]+$/.test(path) || path.includes("..")) return null;
  return SHOPIFY_FILES + path;
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
