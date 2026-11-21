import "server-only";

// Automatic translation of store content (banners, menus, categories, collections, pages,
// product descriptions) into French and Arabic, saved in the database so each text is
// translated once. Uses ANTHROPIC_API_KEY; without it the English text is shown.
// Missing translations never slow a page down: the page shows English and the
// translation is fetched in the background for the next visit.
// Corrections made in Admin → Translations always win.

import { createHash } from "node:crypto";
import { after } from "next/server";
import { db } from "@/lib/db";
import { tr, type Lang } from "@/lib/i18n";

const hash = (s: string) => createHash("sha1").update(s).digest("base64url").slice(0, 16);
const key = (lang: Lang) => `tr:${lang}`;
const g = globalThis as unknown as { __tr?: Map<string, string>; __trPending?: Set<string> };
const mem = (g.__tr ??= new Map());
const pending = (g.__trPending ??= new Set());

export const aiReady = () => !!process.env.ANTHROPIC_API_KEY;

/** Translate many texts at once. Returns a map english → translated (English when not available yet). */
export async function translateMany(texts: string[], lang: Lang, opts: { wait?: boolean } = {}): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (lang === "en") return out;
  const uniq = [...new Set(texts.filter((t) => t && /[A-Za-z]{2}/.test(t)))];
  const missing: string[] = [];
  // 1. interface dictionary, 2. memory cache, 3. database
  const toLoad: string[] = [];
  for (const t of uniq) {
    const d = tr(lang, t);
    if (d !== t) out.set(t, d);
    else if (mem.has(`${lang}|${t}`)) out.set(t, mem.get(`${lang}|${t}`)!);
    else toLoad.push(t);
  }
  if (toLoad.length) {
    const rows = await db.pipeline(toLoad.map((t) => ["HGET", key(lang), hash(t)])).catch(() => toLoad.map(() => null));
    toLoad.forEach((t, i) => {
      const v = rows[i] as string | null;
      if (v) (out.set(t, v), mem.set(`${lang}|${t}`, v));
      else missing.push(t);
    });
  }
  if (missing.length && aiReady()) {
    if (opts.wait) {
      const done = await translateNow(missing, lang);
      for (const [a, b] of done) out.set(a, b);
    } else {
      const todo = missing.filter((t) => !pending.has(`${lang}|${t}`));
      todo.forEach((t) => pending.add(`${lang}|${t}`));
      if (todo.length) {
        try {
          after(() => translateNow(todo, lang).finally(() => todo.forEach((t) => pending.delete(`${lang}|${t}`))));
        } catch {
          void translateNow(todo, lang).finally(() => todo.forEach((t) => pending.delete(`${lang}|${t}`)));
        }
      }
    }
  }
  return out;
}

export async function translateOne(text: string, lang: Lang, opts: { wait?: boolean } = {}) {
  if (lang === "en" || !text) return text;
  return (await translateMany([text], lang, opts)).get(text) ?? text;
}

const LANG_NAME: Record<Exclude<Lang, "en">, string> = { fr: "French (as used in Lebanon)", ar: "Modern Standard Arabic (natural for Lebanese shoppers)" };

/** Calls the AI in batches and stores the results. */
export async function translateNow(texts: string[], lang: Lang): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (lang === "en" || !aiReady()) return out;
  const batches: string[][] = [];
  let cur: string[] = [], size = 0;
  for (const t of texts) {
    if (cur.length && (cur.length >= 40 || size + t.length > 12000)) (batches.push(cur), (cur = []), (size = 0));
    cur.push(t.slice(0, 6000));
    size += t.length;
  }
  if (cur.length) batches.push(cur);
  for (const batch of batches) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_TRANSLATE_MODEL || "claude-haiku-5-5",
        max_tokens: 8000,
        messages: [{
          role: "user",
          content: `Translate each text of this JSON array from English into ${LANG_NAME[lang as "fr" | "ar"]} for a beauty, pharmacy and supplements online shop in Lebanon. Keep brand names, product names, units (ml, g, SPF), prices, codes, URLs, emojis and line breaks unchanged. Keep the tone short and friendly. Return only a JSON array of the same length, in the same order.\n\n${JSON.stringify(batch)}`,
        }],
      }),
    }).catch(() => null);
    if (!res?.ok) continue;
    const data = (await res.json().catch(() => null)) as { content?: { type: string; text?: string }[] } | null;
    const text = data?.content?.find((c) => c.type === "text")?.text ?? "";
    let arr: unknown;
    try {
      arr = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1));
    } catch {
      continue;
    }
    if (!Array.isArray(arr) || arr.length !== batch.length) continue;
    const cmds: (string | number)[][] = [];
    batch.forEach((src, i) => {
      const v = typeof arr[i] === "string" ? (arr[i] as string).trim() : "";
      if (!v) return;
      out.set(src, v);
      mem.set(`${lang}|${src}`, v);
      cmds.push(["HSET", key(lang), hash(src), v], ["HSET", `tr:src`, hash(src), src]);
    });
    if (cmds.length) await db.pipeline(cmds).catch(() => {});
  }
  return out;
}

/** Translate the string fields named in `fields` anywhere inside an object (menus, homepage sections…). */
export async function translateDeep<T>(value: T, lang: Lang, fields: string[], opts: { wait?: boolean } = {}): Promise<T> {
  if (lang === "en") return value;
  const want = new Set(fields);
  const found: string[] = [];
  const walk = (v: unknown, k?: string) => {
    if (typeof v === "string") { if (k && want.has(k)) found.push(v); return; }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, k));
    if (v && typeof v === "object") for (const [kk, vv] of Object.entries(v)) walk(vv, kk);
  };
  walk(value);
  if (!found.length) return value;
  const map = await translateMany(found, lang, opts);
  const build = (v: unknown, k?: string): unknown => {
    if (typeof v === "string") return k && want.has(k) ? map.get(v) ?? v : v;
    if (Array.isArray(v)) return v.map((x) => build(x, k));
    if (v && typeof v === "object") return Object.fromEntries(Object.entries(v).map(([kk, vv]) => [kk, build(vv, kk)]));
    return v;
  };
  return build(value) as T;
}

// ── Admin: list and correct saved translations ──

export async function listTranslations(lang: Lang, cursor = "0", count = 200) {
  const [next, flat] = await db.cmd<[string, string[]]>(["HSCAN", key(lang), cursor, "COUNT", count]);
  const ids = flat.filter((_, i) => i % 2 === 0);
  const src = ids.length ? ((await db.pipeline(ids.map((id) => ["HGET", "tr:src", id]))) as (string | null)[]) : [];
  return { next, items: ids.map((id, i) => ({ id, source: src[i] ?? "", text: flat[i * 2 + 1] })) };
}

export async function saveTranslation(lang: Lang, source: string, text: string) {
  const id = hash(source);
  mem.set(`${lang}|${source}`, text);
  await db.pipeline([["HSET", key(lang), id, text], ["HSET", "tr:src", id, source]]);
}

export const countTranslations = async (lang: Lang) => db.cmd<number>(["HLEN", key(lang)]).catch(() => 0);
