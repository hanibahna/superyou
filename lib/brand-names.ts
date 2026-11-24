import type { ProductLite } from "@/lib/data/catalog";

const squash = (b: string) => b.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, "");
const title = (b: string) => b.toLowerCase().replace(/(^|[\s\-/&·'.])([a-z])/g, (_, a: string, c: string) => a + c.toUpperCase());

/** Maps a brand to the spelling already used in the catalogue; ALL-CAPS new brands become Title Case. */
export function brandName(all: ProductLite[]) {
  const counts = new Map<string, Map<string, number>>();
  for (const p of all) {
    const k = squash(p.brand);
    const m = counts.get(k) ?? counts.set(k, new Map()).get(k)!;
    m.set(p.brand, (m.get(p.brand) ?? 0) + 1);
  }
  // The most used spelling that isn't all capitals wins.
  const best = new Map<string, string>();
  for (const [k, m] of counts) {
    const list = [...m.entries()].sort((a, b) => Number(a[0] === a[0].toUpperCase()) - Number(b[0] === b[0].toUpperCase()) || b[1] - a[1]);
    best.set(k, list[0][0]);
  }
  return (b: string) => {
    const hit = best.get(squash(b));
    if (hit && hit !== hit.toUpperCase()) return hit;
    return b.length > 4 && b === b.toUpperCase() ? title(b) : hit ?? b;
  };
}
