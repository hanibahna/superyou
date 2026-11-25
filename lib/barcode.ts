import "server-only";

// Barcodes for parcel labels: Code 128 (order number, for handheld scanners) and QR (opens the courier page).
export async function barcodeSvg(text: string, kind: "code128" | "qrcode", opts: { height?: number; scale?: number } = {}) {
  // @ts-ignore -- typings don't resolve with this project's module settings
  const mod = await import("bwip-js");
  const bwip = ((mod as { default?: unknown }).default ?? mod) as unknown as { toSVG: (o: Record<string, unknown>) => string };
  return bwip.toSVG({ bcid: kind, text, scale: opts.scale ?? 3, height: opts.height ?? 14, includetext: false, ...(kind === "qrcode" ? { eclevel: "M" } : {}) });
}

/** PNG data URL of a barcode (for images built on the server, e.g. the WhatsApp label picture). */
export async function barcodePng(text: string, kind: "code128" | "qrcode", opts: { height?: number; scale?: number } = {}) {
  // @ts-ignore -- typings don't resolve with this project's module settings
  const mod = await import("bwip-js");
  const bwip = ((mod as { default?: unknown }).default ?? mod) as unknown as { toBuffer: (o: Record<string, unknown>) => Promise<Buffer> };
  const buf = await bwip.toBuffer({ bcid: kind, text, scale: opts.scale ?? 3, height: opts.height ?? 14, includetext: false, ...(kind === "qrcode" ? { eclevel: "M" } : {}) });
  return `data:image/png;base64,${buf.toString("base64")}`;
}
