"use client";

import { useState } from "react";
import { useT } from "@/lib/site-context";
import { StarIcon } from "./Icons";
import { Stars } from "./Stars";

export type PublicReview = { id: string; rating: number; title: string; body: string; name: string; skinType?: string; photo?: string; verified: boolean; createdAt: string; reply?: string };

/** Reviews on the product page: summary, distribution, list and a short form. */
export function Reviews({ slug, product, reviews }: { slug: string; product: string; reviews: PublicReview[] }) {
  const tx = useT();
  const t = useT();
  const [form, setForm] = useState(false);
  const [sort, setSort] = useState<"new" | "high" | "low" | "photos">("new");
  const avg = reviews.length ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length : 0;
  const dist = [5, 4, 3, 2, 1].map((n) => ({ n, c: reviews.filter((r) => r.rating === n).length }));
  const list = [...reviews]
    .filter((r) => sort !== "photos" || r.photo)
    .sort((a, b) => (sort === "high" ? b.rating - a.rating : sort === "low" ? a.rating - b.rating : b.createdAt.localeCompare(a.createdAt)));

  return (
    <section id="reviews" className="container-x scroll-mt-24 border-t border-line py-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 className="text-2xl font-semibold">{t("Reviews")}</h2>
        <button onClick={() => setForm(true)} className="tap rounded-full border border-ink px-5 text-sm font-semibold">{t("Write a review")}</button>
      </div>
      {reviews.length === 0 ? (
        <p className="mt-4 text-muted">{t("No reviews yet — be the first.")}</p>
      ) : (
        <div className="mt-6 grid gap-8 md:grid-cols-[260px_1fr]">
          <div>
            <p className="text-5xl font-bold">{avg.toFixed(1)}</p>
            <Stars value={avg} size={18} />
            <p className="mt-1 text-sm text-muted">{reviews.length} {reviews.length === 1 ? tx("review") : tx("reviews")}</p>
            <ul className="mt-4 space-y-1.5 text-sm">
              {dist.map((d) => (
                <li key={d.n} className="flex items-center gap-2">
                  <span className="w-3">{d.n}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line"><span className="block h-full bg-ink" style={{ width: `${(d.c / reviews.length) * 100}%` }} /></span>
                  <span className="w-6 text-end text-muted">{d.c}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} className="mb-4 rounded-lg border border-line px-3 py-2 text-sm" aria-label={tx("Sort reviews")}>
              <option value="new">{tx("Newest")}</option><option value="high">Highest rated</option><option value="low">Lowest rated</option><option value="photos">With photos</option>
            </select>
            <ul className="divide-y divide-line">
              {list.slice(0, 30).map((r) => (
                <li key={r.id} className="py-5">
                  <div className="flex flex-wrap items-center gap-2"><Stars value={r.rating} size={14} />{r.title && <b className="text-sm">{r.title}</b>}</div>
                  <p className="mt-1 text-xs text-muted">
                    {r.name}{r.skinType ? ` · ${r.skinType} skin` : ""} · {r.createdAt.slice(0, 10)}
                    {r.verified && <span className="ms-2 font-semibold text-green-700">✓ {t("Verified buyer")}</span>}
                  </p>
                  <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
                  {r.photo && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.photo} alt="Customer photo" loading="lazy" className="mt-3 h-28 w-28 rounded-lg object-cover" />
                  )}
                  {r.reply && <p className="mt-3 rounded-lg bg-[#f5f5f5] p-3 text-sm"><b>Pharmacist reply:</b> {r.reply}</p>}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {form && <ReviewForm slug={slug} product={product} onClose={() => setForm(false)} />}
    </section>
  );
}

export function ReviewForm({ slug, product, orderId, token, onClose, inline = false }: { slug: string; product: string; orderId?: string; token?: string; onClose?: () => void; inline?: boolean }) {
  const tx = useT();
  const [rating, setRating] = useState(0);
  const [state, setState] = useState<"idle" | "busy" | "done" | "pending">("idle");
  const [err, setErr] = useState("");
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!rating) return setErr(tx("Please choose a star rating"));
    setState("busy");
    const r = await fetch("/api/reviews/", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, rating, title: fd.get("title"), body: fd.get("body"), name: fd.get("name"), skinType: fd.get("skinType") || undefined, orderId, token }),
    }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) return setState("idle"), setErr(data.error ?? "Please try again");
    setState(data.status === "approved" ? "done" : "pending");
  }
  const body = state === "done" || state === "pending" ? (
    <p className="py-6 text-center font-semibold">{tx("Thank you!")} {state === "pending" ? tx("Your review will appear once our team has checked it.") : tx("Your review is live.")}</p>
  ) : (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted">{product}</p>
      <div className="flex gap-1" role="radiogroup" aria-label={tx("Rating")}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button type="button" key={n} onClick={() => setRating(n)} aria-label={`${n} stars`} aria-checked={rating === n} role="radio" className="p-1">
            <StarIcon width={28} height={28} filled={rating >= n} className={rating >= n ? "text-ink" : "text-line"} />
          </button>
        ))}
      </div>
      <input name="title" placeholder="Headline (optional)" maxLength={100} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
      <textarea name="body" required minLength={3} rows={4} placeholder={tx("What did you like or not like? How did your skin react?")} className="w-full rounded-lg border border-line px-3 py-2 text-sm" />
      <div className="grid grid-cols-2 gap-3">
        <input name="name" required maxLength={60} placeholder={tx("Your first name")} className="rounded-lg border border-line px-3 py-2 text-sm" />
        <select name="skinType" className="rounded-lg border border-line px-3 py-2 text-sm" defaultValue="">
          <option value="">Skin type (optional)</option>{["Dry", "Oily", "Combination", "Normal", "Sensitive"].map((x) => <option key={x}>{x}</option>)}
        </select>
      </div>
      {err && <p className="text-sm text-sale">{err}</p>}
      <button disabled={state === "busy"} className="tap w-full rounded-full bg-ink font-semibold text-white disabled:opacity-60">Submit review</button>
    </form>
  );
  if (inline) return body;
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="sheet-up relative w-full max-w-lg rounded-t-2xl bg-white p-6 md:rounded-2xl">
        <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-semibold">Write a review</h3><button onClick={onClose} aria-label={tx("Close")}>✕</button></div>
        {body}
      </div>
    </div>
  );
}
