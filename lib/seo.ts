import { headers } from "next/headers";

// Search-engine helpers: the public base URL, canonical links and English/Arabic alternates.
export { siteUrl } from "@/lib/site-url";
import { siteUrl } from "@/lib/site-url";

/** Canonical address of the page in the language being served, plus hreflang links to both versions. */
export async function canonical(path: string) {
  const l = (await headers()).get("x-lang");
  const pre = l === "ar" || l === "fr" ? `/${l}` : "";
  const base = siteUrl();
  return { alternates: { canonical: `${base}${pre}${path}`, languages: { en: `${base}${path}`, fr: `${base}/fr${path}`, ar: `${base}/ar${path}`, "x-default": `${base}${path}` } } };
}
