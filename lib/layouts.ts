// Layout themes: fonts, corners, buttons, cards, header and product image shape.
// Colours are separate (lib/theme.ts). Client-safe.

import { z } from "zod";

export type LayoutOptions = {
  preset: string;
  headingFont: "sans" | "serif" | "rounded" | "mono" | "condensed" | "grotesk" | "instrument" | "fraunces";
  bodyFont: "sans" | "serif" | "rounded" | "inter";
  radius: "none" | "small" | "medium" | "large";
  buttons: "pill" | "rounded" | "square";
  cards: "plain" | "border" | "shadow" | "tinted";
  header: "classic" | "centered" | "dark" | "minimal";
  imageRatio: "square" | "portrait" | "landscape";
  density: "comfortable" | "compact" | "spacious";
  uppercaseHeadings: boolean;
  gridColumns: 3 | 4 | 5;
  buyButton: "solid" | "outline" | "hover";
};

export const defaultLayout: LayoutOptions = {
  preset: "classic", headingFont: "sans", bodyFont: "sans", radius: "medium", buttons: "pill", cards: "plain",
  header: "classic", imageRatio: "square", density: "comfortable", uppercaseHeadings: false, gridColumns: 4, buyButton: "solid",
};

export const layoutPresets: { id: string; name: string; note: string; options: LayoutOptions }[] = [
  { id: "atelier", name: "Atelier (editorial luxury)", note: "Large serif headlines with italic accents, warm ivory page, quiet lines, black pills", options: { ...defaultLayout, preset: "atelier", headingFont: "instrument", bodyFont: "inter", radius: "large", buttons: "pill", cards: "plain", header: "centered", imageRatio: "portrait", density: "spacious", uppercaseHeadings: false, gridColumns: 4, buyButton: "outline" } },
  { id: "ritual", name: "Ritual (pharmacist-led)", note: "Calm clinical feel: warm grey page, white rounded cards, soft serif headings, routine first", options: { ...defaultLayout, preset: "ritual", headingFont: "fraunces", bodyFont: "inter", radius: "large", buttons: "rounded", cards: "plain", header: "classic", imageRatio: "square", density: "comfortable", uppercaseHeadings: false, gridColumns: 4, buyButton: "solid" } },
  { id: "pop", name: "Pop (bold & playful)", note: "Big grotesk headlines, pastel colour blocks, soft rounded cards, black pill buttons", options: { ...defaultLayout, preset: "pop", headingFont: "grotesk", bodyFont: "inter", radius: "large", buttons: "pill", cards: "tinted", header: "classic", imageRatio: "square", density: "comfortable", uppercaseHeadings: false, gridColumns: 4, buyButton: "solid" } },
  { id: "noir", name: "Noir (Sephora-style)", note: "Black & white editorial: bold sans, outlined buttons, clean cards", options: { ...defaultLayout, preset: "noir", headingFont: "sans", bodyFont: "sans", radius: "small", buttons: "pill", cards: "plain", header: "classic", imageRatio: "square", density: "comfortable", uppercaseHeadings: false, gridColumns: 5, buyButton: "hover" } },
  { id: "classic", name: "Classic", note: "Friendly, rounded, like the big parapharmacies", options: defaultLayout },
  { id: "minimal", name: "Minimal", note: "Lots of white space, thin lines, quiet type", options: { ...defaultLayout, preset: "minimal", radius: "none", buttons: "square", cards: "plain", header: "minimal", density: "spacious", gridColumns: 4, uppercaseHeadings: true } },
  { id: "luxe", name: "Luxe", note: "Serif headings, dark header, tall product photos", options: { ...defaultLayout, preset: "luxe", headingFont: "serif", radius: "small", buttons: "square", cards: "plain", header: "dark", imageRatio: "portrait", density: "spacious", gridColumns: 3 } },
  { id: "clinical", name: "Clinical", note: "Dermo-pharmacy feel: crisp, bordered, dense", options: { ...defaultLayout, preset: "clinical", radius: "small", buttons: "rounded", cards: "border", header: "classic", density: "compact", gridColumns: 5 } },
  { id: "playful", name: "Playful", note: "Soft round shapes, tinted cards, bold type", options: { ...defaultLayout, preset: "playful", headingFont: "rounded", bodyFont: "rounded", radius: "large", buttons: "pill", cards: "tinted", header: "centered", density: "comfortable", gridColumns: 4 } },
  { id: "editorial", name: "Editorial", note: "Magazine style: serif, centered logo, shadows", options: { ...defaultLayout, preset: "editorial", headingFont: "serif", bodyFont: "serif", radius: "none", buttons: "square", cards: "shadow", header: "centered", imageRatio: "portrait", density: "spacious", uppercaseHeadings: false, gridColumns: 3 } },
  { id: "bold", name: "Bold", note: "Condensed uppercase headings, strong contrast", options: { ...defaultLayout, preset: "bold", headingFont: "condensed", radius: "none", buttons: "square", cards: "border", header: "dark", density: "compact", uppercaseHeadings: true, gridColumns: 4 } },
];

export const layoutSchema = z.object({
  preset: z.string().max(30),
  headingFont: z.enum(["sans", "serif", "rounded", "mono", "condensed", "grotesk", "instrument", "fraunces"]),
  bodyFont: z.enum(["sans", "serif", "rounded", "inter"]),
  radius: z.enum(["none", "small", "medium", "large"]),
  buttons: z.enum(["pill", "rounded", "square"]),
  cards: z.enum(["plain", "border", "shadow", "tinted"]),
  header: z.enum(["classic", "centered", "dark", "minimal"]),
  imageRatio: z.enum(["square", "portrait", "landscape"]),
  density: z.enum(["comfortable", "compact", "spacious"]),
  uppercaseHeadings: z.boolean(),
  gridColumns: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  buyButton: z.enum(["solid", "outline", "hover"]).default("solid"),
});

const fonts = {
  sans: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  serif: '"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Times New Roman", serif',
  rounded: 'ui-rounded, "SF Pro Rounded", "Nunito", "Varela Round", system-ui, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
  instrument: '"Instrument Serif", Georgia, "Times New Roman", serif',
  fraunces: '"Fraunces", Georgia, "Times New Roman", serif',
  grotesk: '"Space Grotesk", "Inter", ui-sans-serif, system-ui, sans-serif',
  inter: '"Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  condensed: '"Avenir Next Condensed", "Arial Narrow", "Roboto Condensed", "Helvetica Neue", sans-serif',
};

const radii = {
  none: { sm: "0px", md: "0px", lg: "0px", xl: "0px", "2xl": "0px", "3xl": "0px" },
  small: { sm: "2px", md: "3px", lg: "4px", xl: "6px", "2xl": "8px", "3xl": "10px" },
  medium: { sm: "0.25rem", md: "0.375rem", lg: "0.5rem", xl: "0.75rem", "2xl": "1rem", "3xl": "1.5rem" },
  large: { sm: "0.5rem", md: "0.75rem", lg: "1rem", xl: "1.25rem", "2xl": "1.75rem", "3xl": "2.25rem" },
};

/** CSS variables + data attributes styles for a layout (injected in the root layout). */
export function layoutCss(o: LayoutOptions): string {
  const r = radii[o.radius];
  const pad = { compact: "0.75", comfortable: "1", spacious: "1.4" }[o.density];
  return `:root:root{--font-sans:${fonts[o.bodyFont]};--font-heading:${fonts[o.headingFont]};${Object.entries(r).map(([k, v]) => `--radius-${k}:${v};`).join("")}--space-scale:${pad};}`;
}

/** Google Fonts stylesheet the layout needs (none for system fonts). */
export function layoutFontsHref(o: LayoutOptions): string | null {
  const fam: string[] = [];
  if (o.headingFont === "grotesk") fam.push("family=Space+Grotesk:wght@500;600;700");
  if (o.headingFont === "instrument") fam.push("family=Instrument+Serif:ital@0;1");
  if (o.headingFont === "fraunces") fam.push("family=Fraunces:opsz,wght@9..144,400;9..144,600");
  if (o.bodyFont === "inter" || ["grotesk", "instrument", "fraunces"].includes(o.headingFont)) fam.push("family=Inter:wght@400;500;600;700");
  return fam.length ? `https://fonts.googleapis.com/css2?${fam.join("&")}&display=swap` : null;
}

/** Attributes put on <html>; globals.css styles them. */
export function layoutAttrs(o: LayoutOptions): Record<string, string> {
  return {
    "data-buttons": o.buttons,
    "data-cards": o.cards,
    "data-header": o.header,
    "data-ratio": o.imageRatio,
    "data-density": o.density,
    "data-upper": o.uppercaseHeadings ? "1" : "0",
    "data-cols": String(o.gridColumns),
    "data-buy": o.buyButton ?? "solid",
    "data-preset": o.preset,
  };
}
