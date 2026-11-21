// Product search over the in-memory index (no external service), driven by Admin → Search:
// searched fields, synonyms, stop words, typo tolerance, pinned (boosted) and hidden items.
// Results are ranked by relevance: name and brand matches count most.

import type { ProductLite, Taxonomy } from "@/lib/data/catalog";
import { defaultSearchSettings, type SearchSettings } from "@/lib/site";

function lev(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 2) return 9;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[b.length];
}

export const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "");
const split = (s: string) => norm(s).split(/[^a-z0-9+%\u0600-\u06ff]+/).filter(Boolean);

type Field = keyof SearchSettings["fields"];
const WEIGHT: Record<Field, number> = { name: 3, brand: 3, sku: 2, barcode: 2, category: 1, concerns: 1, variant: 1 };
type Indexed = { fields: [Field, string[]][]; text: string };

const cache = new WeakMap<object, { key: string; v: Indexed }>();

function indexOf(p: ProductLite, tax: Taxonomy, fields: SearchSettings["fields"]): Indexed {
  const key = JSON.stringify(fields);
  const hit = cache.get(p);
  if (hit && hit.key === key) return hit.v;
  const raw: [Field, string][] = [
    ["name", p.name],
    ["brand", p.brand],
    ["sku", p.sku],
    ["barcode", p.barcode ?? ""],
    ["variant", `${p.variant ?? ""} ${p.size}`],
    ["category", tax.categories.find((c) => c.slug === p.category)?.name ?? ""],
    ["concerns", p.concerns.map((c) => tax.concerns.find((k) => k.slug === c)?.name ?? c).join(" ")],
  ];
  const on = raw.filter(([f]) => fields[f]);
  const v: Indexed = { fields: on.map(([f, t]) => [f, split(t)]), text: ` ${on.map(([, t]) => split(t).join(" ")).join(" ")} ` };
  cache.set(p, { key, v });
  return v;
}

type Term = { alts: string[] }; // any alternative may match (synonyms)

function parse(query: string, s: SearchSettings): Term[] {
  let q = ` ${split(query).join(" ")} `;
  const groups = s.synonyms.map((g) => g.map((w) => split(w).join(" ")).filter(Boolean));
  const terms: Term[] = [];
  // Multi-word synonyms ("sun cream") are matched as phrases first.
  for (const g of groups)
    for (const w of g)
      if (w.includes(" ") && q.includes(` ${w} `)) {
        terms.push({ alts: g });
        q = q.replace(` ${w} `, " ");
      }
  const stop = new Set(s.stopWords.map(norm));
  let words = q.split(" ").filter(Boolean);
  if (words.some((w) => !stop.has(w))) words = words.filter((w) => !stop.has(w));
  for (const w of words) {
    const g = groups.find((x) => x.includes(w));
    terms.push({ alts: g ? Array.from(new Set([w, ...g])) : [w] });
  }
  return terms;
}

function termScore(ix: Indexed, t: Term, fuzzy: boolean): number {
  let best = 0;
  for (const alt of t.alts) {
    if (alt.includes(" ")) {
      if (ix.text.includes(` ${alt} `)) best = Math.max(best, 2.5);
      continue;
    }
    for (const [f, ws] of ix.fields) {
      for (const w of ws) {
        let s = 0;
        if (w === alt) s = WEIGHT[f] + 0.5;
        else if (w.startsWith(alt)) s = WEIGHT[f];
        else if (fuzzy && alt.length >= 4 && (lev(alt, w.slice(0, alt.length)) <= 1 || lev(alt, w) <= 1)) s = WEIGHT[f] * 0.6;
        if (s > best) best = s;
      }
    }
  }
  return best;
}

/** Ranked search. Every term must match (directly, by synonym, or with a typo when allowed). */
export function searchProducts<T extends ProductLite>(list: T[], query: string, tax: Taxonomy, settings: SearchSettings = defaultSearchSettings): T[] {
  const terms = parse(query, settings);
  if (!terms.length) return list;
  const hidden = new Set(settings.hidden);
  const run = (fuzzy: boolean) => {
    const out: { p: T; s: number }[] = [];
    for (const p of list) {
      if (hidden.has(p.slug)) continue;
      const ix = indexOf(p, tax, settings.fields);
      let total = 0;
      for (const t of terms) {
        const s = termScore(ix, t, fuzzy);
        if (!s) {
          total = 0;
          break;
        }
        total += s;
      }
      if (total) out.push({ p, s: total });
    }
    return out;
  };
  let hits = run(false);
  if (hits.length < 5 && settings.typoTolerance) hits = run(true);

  // Pinned items for this search go first, in the order they were pinned.
  const qn = split(query).join(" ");
  const pins = settings.boosts.filter((b) => b.terms.some((t) => split(t).join(" ") === qn)).flatMap((b) => b.slugs);
  const pinRank = (slug: string) => {
    const i = pins.indexOf(slug);
    return i < 0 ? Infinity : i;
  };
  hits.sort((a, b) => pinRank(a.p.slug) - pinRank(b.p.slug) || b.s - a.s);
  if (pins.length) {
    const have = new Set(hits.map((h) => h.p.slug));
    const extra = list.filter((p) => pins.includes(p.slug) && !have.has(p.slug)).sort((a, b) => pinRank(a.slug) - pinRank(b.slug));
    return [...extra, ...hits.map((h) => h.p)];
  }
  return hits.map((h) => h.p);
}

/** Exact-match redirect for a query, if one is set up. */
export function redirectFor(query: string, settings: SearchSettings): string | undefined {
  const q = split(query).join(" ");
  return settings.redirects.find((r) => split(r.term).join(" ") === q)?.url;
}
