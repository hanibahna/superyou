// ─────────────────────────────────────────────────────────────
// Store-wide settings. Change the brand here and it updates everywhere.
// ─────────────────────────────────────────────────────────────

export const store = {
  name: "SuperYou",
  tagline: "Reveal the super in you",
  currency: "USD",
  currencySymbol: "$",
  phone: "+961 00 000 000",
  whatsapp: "96100000000", // international format, digits only
  email: "hello@example.com",
  address: "Beirut, Lebanon",
  freeDeliveryThreshold: 30,
  deliveryFee: 4,
  announcement: "Free delivery on orders over $100 · Free sample with every order over $100",
  social: {
    instagram: "https://instagram.com/",
    facebook: "https://facebook.com/",
    tiktok: "https://tiktok.com/",
  },
  // End time for the homepage "Happy Hour" countdown (ISO). Set null to hide it.
  happyHourEndsAt: null as string | null, // null → rolls over every 24h for demo purposes
};

export const deliveryZones = [
  "Beirut",
  "Metn",
  "Keserwan",
  "Jbeil",
  "Baabda",
  "Aley",
  "Chouf",
  "North Lebanon",
  "South Lebanon",
  "Bekaa",
] as const;

export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "1";
