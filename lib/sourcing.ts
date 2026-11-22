// Where each catalog ships from. Every product carries the name of the catalog it was imported
// from (its "source"); this table says whether that catalog is local stock (ships from Lebanon)
// or international drop shipping, how long delivery takes, and — for international catalogs —
// how the shop price is built from the supplier's price (freight, customs duty, fees, VAT, margin).
// Safe to import from client components: the supplier names stay on the server.

export type Origin = "local" | "international";

export type LandedPricing = {
  freightPerItem: number; // $ per item: supplier → forwarder → Beirut, shared over a batch
  dutyPct: number; // customs duty on CIF (cost + freight)
  feePct: number; // extra customs fee on CIF (3% on VAT-able goods)
  vatPct: number; // VAT on CIF + duty
  clearancePerItem: number; // broker + clearance, shared per item
  marginPct: number; // SuperYou's margin on the landed cost
};

export type SourceRule = {
  source: string; // catalog name as stored on products, e.g. "beautyjoint.com"
  label: string; // internal name shown in the admin only
  origin: Origin;
  country: string; // where it ships from, e.g. "Lebanon", "USA"
  daysMin: number; // working days to the customer's door
  daysMax: number;
  pricing?: LandedPricing; // international catalogs: how prices are built on import
};

export type Sourcing = {
  preferLocal: boolean; // same product in a local and an international catalog → show the local one
  local: { daysMin: number; daysMax: number }; // any catalog not listed below
  sources: SourceRule[];
};

export const defaultLanded: LandedPricing = { freightPerItem: 4, dutyPct: 15, feePct: 3, vatPct: 11, clearancePerItem: 1, marginPct: 35 };

export const defaultSourcing: Sourcing = {
  preferLocal: true,
  local: { daysMin: 1, daysMax: 3 },
  sources: [
    { source: "skinsociety.me", label: "Skin Society (dealer)", origin: "local", country: "Lebanon", daysMin: 1, daysMax: 2 },
    { source: "neovitale.com", label: "NeoVitale (dealer)", origin: "local", country: "Lebanon", daysMin: 1, daysMax: 3 },
    { source: "beautyjoint.com", label: "Beauty Joint (US drop shipper)", origin: "international", country: "USA", daysMin: 10, daysMax: 14, pricing: defaultLanded },
  ],
};

export function withSourcingDefaults(v: Partial<Sourcing> | null | undefined): Sourcing {
  if (!v) return defaultSourcing;
  const have = new Set((v.sources ?? []).map((s) => s.source.toLowerCase()));
  return {
    preferLocal: v.preferLocal ?? defaultSourcing.preferLocal,
    local: { ...defaultSourcing.local, ...v.local },
    sources: [...(v.sources ?? []), ...defaultSourcing.sources.filter((s) => !have.has(s.source))],
  };
}

export type ShipInfo = { origin: Origin; country: string; daysMin: number; daysMax: number };

export function shipInfo(source: string | undefined, s: Sourcing): ShipInfo {
  const r = s.sources.find((x) => x.source.toLowerCase() === (source || "").toLowerCase());
  return r ? { origin: r.origin, country: r.country, daysMin: r.daysMin, daysMax: r.daysMax } : { origin: "local", country: "Lebanon", ...s.local };
}

/** Landed cost and shop price for one item bought abroad at `cost` dollars. */
export function landed(cost: number, p: LandedPricing) {
  const cif = cost + p.freightPerItem;
  const duty = (cif * p.dutyPct) / 100;
  const fee = (cif * p.feePct) / 100;
  const vat = ((cif + duty) * p.vatPct) / 100;
  const total = cif + duty + fee + vat + p.clearancePerItem;
  const price = total * (1 + p.marginPct / 100);
  const r = (n: number) => Math.round(n * 100) / 100;
  return { cost: r(cost), freight: r(p.freightPerItem), duty: r(duty), fee: r(fee), vat: r(vat), clearance: r(p.clearancePerItem), landed: r(total), price: r(price) };
}

/** "1–2 working days" / "10–14 working days" */
export const etaText = (i: { daysMin: number; daysMax: number }) => (i.daysMin === i.daysMax ? `${i.daysMax}` : `${i.daysMin}–${i.daysMax}`) + " working days";

/** The date a customer can expect it by, skipping Sundays. */
export function etaDate(daysMax: number, from = new Date()) {
  const d = new Date(from);
  let n = daysMax;
  while (n > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0) n--;
  }
  return d;
}
