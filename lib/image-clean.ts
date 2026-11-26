import "server-only";

import { createHash } from "node:crypto";
import sharp from "sharp";
import { db } from "@/lib/db";

// Removes promotional overlays (discount %, "SALE", prices, "offer", "gift with purchase"…) that suppliers
// print on product photos. Claude looks at each photo; when it finds an overlay, the box is painted over
// with the background colour around it (plain backgrounds) or cropped off (overlay on an edge).
// Anything it can't clean safely is listed for a person to look at. Cleaned photos go to Vercel Blob.

export type CleanResult = { status: "clean" | "fixed" | "manual" | "error"; out?: string; why?: string; at: string };
const DONE = "imgclean:v1";
const key = (u: string) => createHash("sha1").update(u).digest("hex");

type Box = { x: number; y: number; w: number; h: number };
type Seen = { promo: boolean; boxes: Box[]; what?: string };

async function ask(model: string, jpeg: Buffer, wantBoxes: boolean): Promise<Seen | null> {
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return null;
  const prompt = `This is a product photo for an online pharmacy and beauty shop.
Is there PROMOTIONAL text or a badge ADDED ON TOP of the photo by a retailer: a discount (e.g. "-20%", "20% OFF"), "SALE", "OFFER", "PROMO", a price, "Buy 1 get 1", "Free gift", "Limited time", "Special price", "Bundle deal", "New price"?
Do NOT count text printed on the product's own packaging (brand, product name, "SPF 50", "50 ml", "new formula" on the box), and do not count the brand's own campaign artwork without a discount or price.
${wantBoxes ? `If yes, give a tight box around EACH added overlay (badge shape included), as fractions 0-1 of the image width and height, x,y = top-left.` : ""}
Reply with JSON only: {"promo":true|false${wantBoxes ? `,"boxes":[{"x":0.05,"y":0.04,"w":0.2,"h":0.1}]` : ""},"what":"the overlay words, short"}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": k, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model, max_tokens: 400,
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpeg.toString("base64") } }, { type: "text", text: prompt }] }],
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch(() => null);
  if (!r?.ok) return null;
  const j = (await r.json().catch(() => ({}))) as { content?: { text?: string }[] };
  const t = (j.content ?? []).map((c) => c.text ?? "").join("");
  try {
    const o = JSON.parse(t.match(/\{[\s\S]*\}/)?.[0] ?? "{}");
    const boxes = (Array.isArray(o.boxes) ? o.boxes : []).map((b: Box) => ({ x: +b.x, y: +b.y, w: +b.w, h: +b.h })).filter((b: Box) => [b.x, b.y, b.w, b.h].every((n) => n >= 0 && n <= 1) && b.w > 0 && b.h > 0);
    return { promo: !!o.promo, boxes, what: String(o.what ?? "").slice(0, 80) };
  } catch {
    return null;
  }
}

/** Median colour and spread of a ring of pixels around a box: plain background = small spread. */
async function ringColour(img: ReturnType<typeof sharp>, W: number, H: number, b: { l: number; t: number; w: number; h: number }) {
  const pad = Math.max(6, Math.round(Math.min(W, H) * 0.02));
  const l = Math.max(0, b.l - pad), t = Math.max(0, b.t - pad), r = Math.min(W, b.l + b.w + pad), bt = Math.min(H, b.t + b.h + pad);
  const { data, info } = await img.clone().extract({ left: l, top: t, width: r - l, height: bt - t }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const px: number[][] = [];
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const inside = x + l >= b.l && x + l < b.l + b.w && y + t >= b.t && y + t < b.t + b.h;
      if (inside) continue;
      const i = (y * info.width + x) * 3;
      px.push([data[i], data[i + 1], data[i + 2]]);
    }
  if (px.length < 20) return null;
  const med = [0, 1, 2].map((c) => px.map((p) => p[c]).sort((a, z) => a - z)[px.length >> 1]);
  const spread = Math.sqrt(px.reduce((s, p) => s + (p[0] - med[0]) ** 2 + (p[1] - med[1]) ** 2 + (p[2] - med[2]) ** 2, 0) / px.length / 3);
  return { rgb: med, spread };
}

/** Paint over or crop off the overlays. null = not safe to clean automatically. */
async function repair(buf: Buffer, boxes: Box[]): Promise<{ out: Buffer; how: string } | null> {
  const base = sharp(buf).rotate();
  const meta = await base.metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  if (!W || !H) return null;
  let crop = { l: 0, t: 0, r: W, b: H };
  const paints: { l: number; t: number; w: number; h: number; rgb: number[] }[] = [];
  for (const bx of boxes) {
    // A little margin so the badge's edge and shadow go too.
    const m = 0.02;
    const l = Math.max(0, Math.floor((bx.x - m) * W)), t = Math.max(0, Math.floor((bx.y - m) * H));
    const w = Math.min(W - l, Math.ceil((bx.w + 2 * m) * W)), h = Math.min(H - t, Math.ceil((bx.h + 2 * m) * H));
    const ring = await ringColour(base, W, H, { l, t, w, h });
    if (ring && ring.spread < 14) { paints.push({ l, t, w, h, rgb: ring.rgb }); continue; }
    // Busy background: crop the strip off when the overlay sits along an edge (at most 22% of the side).
    if (t + h <= H * 0.22) crop.t = Math.max(crop.t, t + h);
    else if (t >= H * 0.78) crop.b = Math.min(crop.b, t);
    else if (l + w <= W * 0.22) crop.l = Math.max(crop.l, l + w);
    else if (l >= W * 0.78) crop.r = Math.min(crop.r, l);
    else return null;
  }
  let img = base.clone();
  if (paints.length)
    img = img.composite(paints.map((p) => ({ input: { create: { width: p.w, height: p.h, channels: 3 as const, background: { r: p.rgb[0], g: p.rgb[1], b: p.rgb[2] } } }, left: p.l, top: p.t })));
  let out = await img.jpeg({ quality: 90 }).toBuffer();
  if (crop.l || crop.t || crop.r < W || crop.b < H) {
    const cw = crop.r - crop.l, ch = crop.b - crop.t;
    if (cw < W * 0.6 || ch < H * 0.6) return null;
    // Crop, then pad back to a square on the edge colour so the photo keeps its framing.
    const side = Math.max(cw, ch);
    const edge = (await ringColour(sharp(out), W, H, { l: crop.l + 2, t: crop.t + 2, w: Math.max(1, cw - 4), h: Math.max(1, ch - 4) }))?.rgb ?? [255, 255, 255];
    out = await sharp(out).extract({ left: crop.l, top: crop.t, width: cw, height: ch })
      .extend({ top: Math.floor((side - ch) / 2), bottom: Math.ceil((side - ch) / 2), left: Math.floor((side - cw) / 2), right: Math.ceil((side - cw) / 2), background: { r: edge[0], g: edge[1], b: edge[2] } })
      .jpeg({ quality: 90 }).toBuffer();
  }
  return { out, how: paints.length && crop.t + crop.l + (W - crop.r) + (H - crop.b) ? "painted and cropped" : paints.length ? "painted over" : "cropped" };
}

/** Check one photo (cached by its address). */
export async function cleanImage(url: string, { dry = false } = {}): Promise<CleanResult> {
  const prev = await db.cmd<string | null>(["HGET", DONE, key(url)]);
  if (prev) return JSON.parse(prev);
  const at = new Date().toISOString();
  const save = async (r: CleanResult) => { if (!dry || r.status === "clean") await db.cmd(["HSET", DONE, key(url), JSON.stringify(r)]); return r; };
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) }).catch(() => null);
  if (!res?.ok) return { status: "error", why: `download ${res?.status ?? "failed"}`, at };
  const buf = Buffer.from(await res.arrayBuffer());
  const small = await sharp(buf).rotate().resize(768, 768, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer().catch(() => null);
  if (!small) return { status: "error", why: "unreadable image", at };
  // A quick look first; only photos with an overlay get the careful look that places the boxes.
  const quick = await ask(process.env.ANTHROPIC_IMGCHECK_MODEL || "claude-haiku-5-5", small, false);
  if (!quick) return { status: "error", why: "vision check failed", at };
  if (!quick.promo) return save({ status: "clean", at });
  const full = await ask(process.env.ANTHROPIC_IMGFIX_MODEL || "claude-sonnet-5-5", small, true);
  if (!full) return { status: "error", why: "vision check failed", at };
  if (!full.promo) return save({ status: "clean", at });
  if (!full.boxes.length) return save({ status: "manual", why: `overlay "${full.what}" but no box`, at });
  const fixed = await repair(await sharp(buf).flatten({ background: "#ffffff" }).jpeg({ quality: 95 }).toBuffer(), full.boxes).catch(() => null);
  if (!fixed) return save({ status: "manual", why: `overlay "${full.what}" on a busy part of the photo`, at });
  if (dry) return { status: "fixed", why: `${fixed.how}: "${full.what}" (dry run, not uploaded)`, at };
  const { put } = await import("@vercel/blob");
  const out = (await put(`photos/${key(url)}.jpg`, fixed.out, { access: "public", addRandomSuffix: false, allowOverwrite: true, contentType: "image/jpeg" })).url;
  return save({ status: "fixed", out, why: `${fixed.how}: "${full.what}"`, at });
}

export async function cleanStats() {
  const vals = ((await db.cmd<string[] | null>(["HVALS", DONE])) ?? []).map((v) => JSON.parse(v) as CleanResult);
  const by = (s: CleanResult["status"]) => vals.filter((v) => v.status === s).length;
  return { checked: vals.length, clean: by("clean"), fixed: by("fixed"), manual: by("manual") };
}
export async function cleanResult(url: string): Promise<CleanResult | null> {
  const v = await db.cmd<string | null>(["HGET", DONE, key(url)]);
  return v ? JSON.parse(v) : null;
}
