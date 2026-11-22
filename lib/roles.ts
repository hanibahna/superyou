// Staff roles and what each one can open in the admin. Client-safe (used by the menu too).

export const ROLES = ["owner", "manager", "orders", "catalog", "marketing"] as const;
export type Role = (typeof ROLES)[number];

export const AREAS = ["orders", "inventory", "catalog", "marketing", "store", "sales", "settings", "staff"] as const;
export type Area = (typeof AREAS)[number];

export const roleInfo: Record<Role, { label: string; about: string; areas: Area[] }> = {
  owner: { label: "Owner", about: "Everything, including staff accounts.", areas: [...AREAS] },
  manager: { label: "Manager", about: "Everything except adding or removing staff.", areas: AREAS.filter((a) => a !== "staff") },
  orders: { label: "Orders & delivery", about: "Orders, bookings, couriers, invoices, refunds, gift cards, abandoned carts and stock counts.", areas: ["orders", "inventory"] },
  catalog: { label: "Catalog", about: "Products, categories, collections, imports and stock counts.", areas: ["catalog", "inventory"] },
  marketing: { label: "Marketing & content", about: "Promotions, reviews, club, WhatsApp, homepage, menus and translations.", areas: ["marketing", "store"] },
};

/** Which area an admin page or admin API path belongs to ("any" = every signed-in staff member). */
export function areaOf(path: string): Area | "any" {
  const seg = path.replace(/^\/(api\/)?admin\/?/, "").split("/")[0] ?? "";
  const map: Record<string, Area | "any"> = {
    "": "any", help: "any", upload: "any", lookup: "any", me: "any",
    orders: "orders", bookings: "orders", carts: "orders", giftcards: "orders", customers: "orders",
    inventory: "inventory",
    products: "catalog", taxonomy: "catalog", collections: "catalog", visibility: "catalog", import: "catalog", "import-store": "catalog",
    catalog: "catalog", "photo-match": "catalog", rehost: "catalog", export: "catalog", template: "catalog",
    growth: "marketing", promotions: "marketing", reviews: "marketing", club: "marketing", whatsapp: "marketing", videos: "marketing",
    routine: "marketing", services: "marketing", subscribers: "marketing", marketing: "marketing", sms: "marketing",
    sourcing: "catalog", "tracking-keys": "settings",
    homepage: "store", landing: "store", navigation: "store", layout: "store", appearance: "store", theme: "store",
    search: "store", "search-settings": "store", translations: "store",
    sales: "sales", activity: "sales",
    settings: "settings", operations: "settings",
    staff: "staff",
  };
  return map[seg] ?? "settings"; // anything new defaults to managers and the owner
}

export const can = (role: Role, area: Area | "any") => area === "any" || roleInfo[role].areas.includes(area);
