"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { ProductImage } from "@/components/ProductImage";
import { MediaField } from "./fields";
import { discountPct, tagLabels, TAGS, type Product, type Tag, type Taxonomy } from "@/lib/data/catalog";

type Draft = {
  name: string; brand: string; sku: string; barcode: string; category: string; concerns: string[];
  price: string; compareAt: string; size: string; stock: string; status: "active" | "draft"; tags: Tag[];
  images: string[]; description: string; howToUse: string; ingredients: string; video: string;
};

const fromProduct = (p?: Product): Draft => ({
  name: p?.name ?? "", brand: p?.brand ?? "", sku: p?.sku ?? "", barcode: p?.barcode ?? "",
  category: p?.category ?? "", concerns: p?.concerns ?? [], price: p ? String(p.price) : "",
  compareAt: p?.compareAt ? String(p.compareAt) : "", size: p?.size ?? "", stock: p?.stock === undefined ? "" : String(p.stock),
  status: p?.status ?? "active", tags: p?.tags ?? [], images: p?.images ?? [],
  description: p?.description ?? "", howToUse: p?.howToUse ?? "", ingredients: p?.ingredients ?? "", video: p?.video ?? "",
});

export function ProductForm({ taxonomy, product }: { taxonomy: Taxonomy; product?: Product }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(fromProduct(product));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((x) => ({ ...x, [k]: v }));
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

  const payload = (over: Partial<Draft> & { id?: string } = {}) => {
    const x = { ...d, ...over };
    return {
      id: "id" in over ? over.id : product?.id,
      sku: x.sku, name: x.name, brand: x.brand, category: x.category, concerns: x.concerns,
      price: x.price, compareAt: x.compareAt || undefined, size: x.size, stock: x.stock === "" ? undefined : x.stock,
      status: x.status, tags: x.tags, images: x.images, description: x.description,
      howToUse: x.howToUse, ingredients: x.ingredients, barcode: x.barcode, video: x.video,
    };
  };

  async function save(body: object, after?: (p: Product) => void) {
    setBusy(true);
    setMsg(null);
    const res = await fetch("/api/admin/products/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "Could not save" });
    setMsg({ ok: true, text: "Saved" });
    after?.(data.product);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setMsg(null);
    const urls: string[] = [];
    for (const f of Array.from(files)) {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch("/api/admin/upload/", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) { setMsg({ ok: false, text: data.error }); break; }
      urls.push(data.url);
    }
    setD((x) => ({ ...x, images: [...x.images, ...urls] }));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const pct = discountPct({ price: Number(d.price) || 0, compareAt: Number(d.compareAt) || undefined });
  const input = "w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";
  const label = "mb-1 block text-xs font-semibold text-muted";
  const card = "rounded-xl bg-white p-5 shadow-sm";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save(payload(), (p) => { if (!product) router.replace(`/admin/products/${p.id}/`); else router.refresh(); });
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/admin/products/" className="text-sm text-muted hover:underline">← Products</Link>
          <h1 className="mt-1 text-2xl font-semibold">{product ? product.name : "New product"}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {msg && <span className={`text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</span>}
          {product?.status === "active" && (
            <a href={`/products/${product.slug}/`} target="_blank" className="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-brand-50">View ↗</a>
          )}
          {product && (
            <button type="button" disabled={busy} onClick={() =>
              save(payload({ id: undefined, sku: `${d.sku}-COPY`, name: `${d.name} (copy)`, status: "draft" }), (p) => router.push(`/admin/products/${p.id}/`))
            } className="rounded-lg border border-line bg-white px-4 py-2 text-sm hover:bg-brand-50">Duplicate</button>
          )}
          <button disabled={busy} className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <section className={card}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className={label}>Name *</label>
                <input required value={d.name} onChange={(e) => set("name", e.target.value)} className={input} />
              </div>
              <div><label className={label}>Brand</label><input value={d.brand} onChange={(e) => set("brand", e.target.value)} className={input} /></div>
              <div><label className={label}>Size</label><input value={d.size} onChange={(e) => set("size", e.target.value)} placeholder="e.g. 50 ml" className={input} /></div>
            </div>
          </section>

          <section className={card}>
            <h2 className="mb-3 font-semibold">Photos</h2>
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
              {d.images.map((src, i) => (
                <div key={src + i} className="group relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={src} alt="" className={`aspect-square w-full rounded-lg border bg-[#f6f7f6] object-contain ${i === 0 ? "border-brand-500" : "border-line"}`} />
                  {i === 0 && <span className="absolute left-1 top-1 rounded bg-brand-500 px-1.5 text-[10px] font-semibold text-white">Main</span>}
                  <div className="absolute inset-x-1 bottom-1 hidden justify-between group-hover:flex">
                    <button type="button" disabled={i === 0} onClick={() => set("images", [d.images[i], ...d.images.filter((_, n) => n !== i)])} className="rounded bg-white/90 px-1.5 text-xs disabled:opacity-0">★ Main</button>
                    <button type="button" onClick={() => set("images", d.images.filter((_, n) => n !== i))} className="rounded bg-white/90 px-1.5 text-xs text-sale">Remove</button>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => fileRef.current?.click()} className="grid aspect-square place-items-center rounded-lg border-2 border-dashed border-line text-xs text-muted hover:border-brand-500 hover:text-brand-600">
                {uploading ? "Uploading…" : "+ Upload"}
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
            </div>
            <div className="mt-3 flex gap-2">
              <input value={urlInput} onChange={(e) => setUrlInput(e.target.value)} placeholder="…or paste an image URL" className={input} />
              <button type="button" onClick={() => { if (/^https?:\/\//.test(urlInput)) { set("images", [...d.images, urlInput.trim()]); setUrlInput(""); } }} className="rounded-lg border border-line px-3 text-sm hover:bg-brand-50">Add</button>
            </div>
            {d.images.length === 0 && (
              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <ProductImage product={{ brand: d.brand || "Brand", shape: product?.shape ?? "bottle", color: product?.color ?? "#cfe3f2" }} className="h-12 w-12 rounded" />
                No photos yet — the shop shows a drawn placeholder.
              </div>
            )}
          </section>

          <section className={card}>
            <h2 className="mb-3 font-semibold">Product information</h2>
            <div className="space-y-4">
              <div><label className={label}>Description</label><textarea rows={5} value={d.description} onChange={(e) => set("description", e.target.value)} className={input} /></div>
              <div><label className={label}>How to use</label><textarea rows={3} value={d.howToUse} onChange={(e) => set("howToUse", e.target.value)} className={input} /></div>
              <MediaField kind="video" label="How-to video" hint="TikTok, Instagram Reel, YouTube or Vimeo link — or upload an MP4. Shown in “How to use” on the product page." value={d.video} onChange={(v) => set("video", v)} />
              <div><label className={label}>Ingredients</label><textarea rows={3} value={d.ingredients} onChange={(e) => set("ingredients", e.target.value)} className={input} /></div>
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <label className={label}>Status</label>
            <select value={d.status} onChange={(e) => set("status", e.target.value as Draft["status"])} className={input}>
              <option value="active">Live — visible in the shop</option>
              <option value="draft">Draft — hidden</option>
            </select>
          </section>

          <section className={card}>
            <h2 className="mb-3 font-semibold">Pricing & stock</h2>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>Price (USD) *</label><input required inputMode="decimal" value={d.price} onChange={(e) => set("price", e.target.value)} className={input} /></div>
              <div><label className={label}>Compare-at</label><input inputMode="decimal" value={d.compareAt} onChange={(e) => set("compareAt", e.target.value)} placeholder="optional" className={input} /></div>
              {pct && <p className="col-span-2 -mt-1 text-xs text-sale">Shows as −{pct}% off</p>}
              <div><label className={label}>SKU *</label><input required value={d.sku} onChange={(e) => set("sku", e.target.value)} className={`${input} font-mono`} /></div>
              <div><label className={label}>Barcode</label><input value={d.barcode} onChange={(e) => set("barcode", e.target.value)} className={`${input} font-mono`} /></div>
              <div className="col-span-2">
                <label className={label}>Stock quantity</label>
                <input inputMode="numeric" value={d.stock} onChange={(e) => set("stock", e.target.value)} placeholder="Leave empty if you don't track stock" className={input} />
              </div>
            </div>
          </section>

          <section className={card}>
            <h2 className="mb-3 font-semibold">Organisation</h2>
            <label className={label}>Category</label>
            <select value={d.category} onChange={(e) => set("category", e.target.value)} className={input}>
              <option value="">— none —</option>
              {taxonomy.categories.map((c) => <option key={c.slug} value={c.slug}>{c.name}</option>)}
            </select>
            <label className={`${label} mt-4`}>Concerns</label>
            <div className="max-h-48 space-y-1 overflow-y-auto text-sm">
              {taxonomy.concerns.map((c) => (
                <label key={c.slug} className="flex items-center gap-2">
                  <input type="checkbox" checked={d.concerns.includes(c.slug)} onChange={() => set("concerns", toggle(d.concerns, c.slug))} />
                  {c.name} <span className="text-xs text-muted">({c.group})</span>
                </label>
              ))}
            </div>
            <label className={`${label} mt-4`}>Homepage badges</label>
            <div className="space-y-1 text-sm">
              {TAGS.map((t) => (
                <label key={t} className="flex items-center gap-2">
                  <input type="checkbox" checked={d.tags.includes(t)} onChange={() => set("tags", toggle(d.tags, t))} />
                  {tagLabels[t]}
                </label>
              ))}
            </div>
          </section>

          {product && <DeleteProduct id={product.id} />}
        </div>
      </div>
    </form>
  );
}

function DeleteProduct({ id }: { id: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      onClick={async () => {
        if (!window.confirm("Delete this product permanently?")) return;
        await fetch("/api/admin/products/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", ids: [id] }) });
        router.push("/admin/products/");
        router.refresh();
      }}
      className="w-full rounded-lg border border-line bg-white py-2 text-sm text-sale hover:bg-red-50"
    >
      Delete product
    </button>
  );
}
