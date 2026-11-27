import type { Tile } from "@/lib/site";
import type { CardItem } from "@/lib/listing";

// Keeps homepage cards honest at render time, whatever was typed in Admin → Homepage:
// - a card that names a well-known brand we don't sell is dropped;
// - a card about a dated event that has already passed is dropped;
// - "up to −70%" is cut back to the real best discount on the products the card links to (or removed).
const BIG_BRANDS = ["Lancôme", "Lancome", "Yves Saint Laurent", "YSL", "Armani", "Valentino", "Prada", "Dior", "Chanel", "Gucci", "Sephora", "Tom Ford", "Versace", "Burberry", "Givenchy", "Hugo Boss", "Paco Rabanne", "Rabanne", "Carolina Herrera", "Jo Malone", "Huda Beauty", "Fenty", "Charlotte Tilbury", "Benefit", "NARS", "MAC", "Kiehl's", "Estée Lauder", "Clinique", "Shiseido", "Guerlain", "Hermès", "Jean Paul Gaultier", "Mugler", "Narciso Rodriguez", "Bvlgari", "Montblanc", "Calvin Klein", "Dolce & Gabbana"];
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function cardsBehind(href: string, cards: CardItem[]): CardItem[] {
  let u: URL;
  try { u = new URL(href || "/shop/", "https://x.local"); } catch { return cards; }
  const q = u.searchParams;
  let pool = cards.filter((c) => c.inStock);
  const cat = q.get("category"), brand = q.get("brand"), term = q.get("q");
  const brandPath = u.pathname.match(/^\/brands\/([^/]+)/)?.[1];
  if (cat) pool = pool.filter((c) => cat.split(",").includes(c.category));
  if (brand || brandPath) { const b = norm(decodeURIComponent(brand || brandPath!)).replace(/-/g, " "); pool = pool.filter((c) => norm(c.brand).replace(/-/g, " ") === b); }
  if (term) { const t = norm(term); pool = pool.filter((c) => norm(`${c.brand} ${c.name}`).includes(t)); }
  if (q.get("bf") === "1") pool = pool.filter((c) => c.bf);
  return pool;
}

const realMaxOff = (pool: CardItem[]) => Math.max(0, ...pool.map((c) => (c.compareAt && c.compareAt > c.price ? Math.floor((1 - c.price / c.compareAt) * 100) : 0)));

function pastEvent(text: string, now: Date): boolean {
  const t = norm(text);
  for (const [i, m] of MONTHS.entries()) {
    const re = new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${m}|${m}\\s+(\\d{1,2})(?!\\d)`);
    const hit = t.match(re);
    if (!hit) continue;
    const day = Number(hit[1] ?? hit[2]);
    const year = Number(t.match(/\b(20\d\d)\b/)?.[1] ?? now.getFullYear());
    const end = new Date(year, i, day, 23, 59);
    if (end < now) return true;
  }
  return false;
}

const PCT = /(up to\s*)?[−–-]\s*(\d{1,2})\s*%|up to\s*(\d{1,2})\s*%(\s*off)?/gi;
const PCT_TEST = new RegExp(PCT.source, "i");
function fixPct(s: string, real: number): string {
  if (!s) return s;
  return s.replace(PCT, (m, _u, a, b) => {
    const claimed = Number(a ?? b);
    if (claimed <= real) return m;
    return real >= 5 ? `up to −${real}%` : "";
  }).replace(/\s{2,}/g, " ").replace(/^\s*[·,:–-]\s*|\s*[·,:–-]\s*$/g, "").trim();
}

export function honestTiles(items: Tile[], cards: CardItem[], now = new Date()): Tile[] {
  const sold = new Set(cards.map((c) => norm(c.brand)));
  return items.filter((t) => {
    const text = `${t.title} ${t.text} ${t.badge} ${t.cta}`;
    const n = ` ${norm(text)} `;
    const unsold = BIG_BRANDS.some((b) => { const k = norm(b); return new RegExp(`[^a-z]${k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^a-z]`).test(n) && !sold.has(k); });
    return !unsold && !pastEvent(text, now);
  }).map((t) => {
    if (!PCT_TEST.test(`${t.title} ${t.text} ${t.badge}`)) return t;
    const real = realMaxOff(cardsBehind(t.href, cards));
    return { ...t, badge: fixPct(t.badge, real), title: fixPct(t.title, real) || t.title, text: fixPct(t.text, real) };
  });
}

/** Brand strip: only brands we actually sell. */
export const soldBrands = (brands: string[], cards: CardItem[]) => {
  const sold = new Set(cards.map((c) => norm(c.brand)));
  return brands.filter((b) => sold.has(norm(b)));
};
