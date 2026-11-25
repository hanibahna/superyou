import "server-only";

import { db } from "@/lib/db";
import { fullName } from "@/lib/data/catalog";

// A long list of tips for ONE product, written once by AI from the product's own details and
// stored (static after the first visit). Only tips that apply to this exact product.
const K = (slug: string) => `ptips:v1:${slug}`;

export async function getProductTips(slug: string): Promise<string[] | null> {
  const raw = await db.cmd<string | null>(["GET", K(slug)]).catch(() => null);
  return raw ? (JSON.parse(raw) as string[]) : null;
}

export async function makeProductTips(slug: string, p: { brand: string; name: string; category: string; description: string; howToUse: string; ingredients: string }): Promise<string[]> {
  const { anthropicKey } = await import("@/lib/extras");
  const key = await anthropicKey();
  if (!key) return [];
  if (!(await db.cmd<string | null>(["SET", `${K(slug)}:lock`, "1", "NX", "EX", "90"]).catch(() => "OK"))) return [];
  const info = [`Product: ${fullName(p.brand, p.name)}`, `Category: ${p.category}`, p.description && `Description: ${p.description.slice(0, 2500)}`, p.howToUse && `Directions from the maker: ${p.howToUse.slice(0, 1500)}`, p.ingredients && `Ingredients: ${p.ingredients.slice(0, 1200)}`].filter(Boolean).join("\n");
  const prompt = `Write practical tips for shoppers of ONE product on SuperYou, a beauty and parapharmacy shop in Lebanon.

${info}

Write 12 to 16 tips that are specifically useful for THIS product (its type, its key ingredients, its texture/format, who it's for). Cover: getting the best results, how to layer or combine it (and what not to combine it with), when in the routine, how much to use, storage and shelf life after opening, common mistakes, and the safety points that apply (patch test, eyes, pregnancy, children, sun sensitivity) when relevant to its ingredients.
Rules: each tip one or two short sentences, max 30 words; plain friendly English; no brand praise, no medical claims or promises; never contradict the maker's directions; no tip that would only fit a different product. Skip anything you're not sure applies.
Reply with ONLY a JSON array of strings.`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: process.env.ANTHROPIC_TIPS_MODEL || "claude-sonnet-5-5", max_tokens: 2000, messages: [{ role: "user", content: prompt }] }),
    signal: AbortSignal.timeout(50_000),
  }).catch(() => null);
  if (!r?.ok) { await db.cmd(["DEL", `${K(slug)}:lock`]).catch(() => {}); return []; }
  const j = (await r.json().catch(() => ({}))) as { content?: { type: string; text?: string }[] };
  const text = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("");
  let tips: string[] = [];
  try { tips = (JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)) as unknown[]).map((x) => String(x).trim().slice(0, 240)).filter(Boolean).slice(0, 16); } catch {}
  if (tips.length) await db.cmd(["SET", K(slug), JSON.stringify(tips)]).catch(() => {});
  return tips;
}
