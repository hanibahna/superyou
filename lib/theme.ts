// Shop colour palette. Edited at /admin/appearance and applied site-wide as CSS variables.
// Safe to import from client components (no server-only code here).

export type ThemeInput = { primary: string; ink: string; sale: string; background: string };

export type Palette = {
  "brand-50": string;
  "brand-100": string;
  "brand-500": string;
  "brand-600": string;
  "brand-700": string;
  ink: string;
  muted: string;
  line: string;
  sale: string;
  bg: string;
};

export const defaultTheme: ThemeInput = { primary: "#c0587a", ink: "#2e2229", sale: "#d23c3c", background: "#ffffff" };

export const presets: { name: string; note: string; theme: ThemeInput }[] = [
  { name: "SuperYou Rose", note: "Default — rose & plum", theme: defaultTheme },
  { name: "Noir & Rose", note: "Black & white, rose accents (Sephora-style)", theme: { primary: "#111111", ink: "#000000", sale: "#c0587a", background: "#ffffff" } },
  { name: "Blush Nude", note: "Soft, makeup & skincare", theme: { primary: "#b9786b", ink: "#2f2624", sale: "#c8423b", background: "#fffaf7" } },
  { name: "Lavender Calm", note: "Wellness & sleep", theme: { primary: "#7b5ea7", ink: "#25202e", sale: "#d0414b", background: "#ffffff" } },
  { name: "Botanic Green", note: "Natural & pharmacy", theme: { primary: "#3f8f63", ink: "#1d2621", sale: "#d24545", background: "#ffffff" } },
  { name: "Clinical Blue", note: "Dermo & medical", theme: { primary: "#2f6fb0", ink: "#1b2430", sale: "#d33b3b", background: "#ffffff" } },
  { name: "Noir & Gold", note: "Premium & luxury", theme: { primary: "#a8803f", ink: "#161616", sale: "#c23a3a", background: "#fffdf8" } },
];

const HEX = /^#[0-9a-f]{6}$/i;
export const isHex = (s: string) => HEX.test(s);

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (c: number[]) => "#" + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0")).join("");
/** Blend colour a toward b by t (0–1). */
export const mix = (a: string, b: string, t: number) => {
  const x = rgb(a), y = rgb(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * t));
};

/** Build the full palette from the four colours the owner picks. */
export function buildPalette(t: ThemeInput): Palette {
  return {
    "brand-50": mix(t.primary, "#ffffff", 0.92),
    "brand-100": mix(t.primary, "#ffffff", 0.82),
    "brand-500": t.primary,
    "brand-600": mix(t.primary, "#000000", 0.13),
    "brand-700": mix(t.primary, "#000000", 0.28),
    ink: t.ink,
    muted: mix(t.ink, t.background, 0.45),
    line: mix(t.ink, t.background, 0.9),
    // Prices and badges sit on white and pale grey: darken the sale colour just enough to read (WCAG 4.5:1).
    sale: readable(t.sale, mix(t.background, "#000000", 0.04)),
    bg: t.background,
  };
}

export function paletteCss(p: Palette, selector = ":root:root"): string {
  const vars = Object.entries(p)
    .filter(([k]) => k !== "bg")
    .map(([k, v]) => `--color-${k}:${v}`)
    .join(";");
  return `${selector}{${vars};--color-bg:${p.bg}}`;
}

// WCAG contrast ratio
function lum(hex: string) {
  return rgb(hex)
    .map((v) => v / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((s, c, i) => s + c * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a: string, b: string) {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** The colour, darkened in small steps until it has at least `min` contrast against `bg`. */
export function readable(color: string, bg: string, min = 4.5) {
  if (!isHex(color) || !isHex(bg)) return color;
  for (let t = 0; t <= 0.6; t += 0.03) {
    const c = t ? mix(color, "#000000", t) : color;
    if (contrast(c, bg) >= min) return c;
  }
  return mix(color, "#000000", 0.6);
}
