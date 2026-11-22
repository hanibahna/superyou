"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { money } from "@/lib/format";
import { useShop } from "@/lib/store";

type P = { slug: string; name: string; brand: string; price: number; compareAt?: number; image?: string; inStock: boolean; variantCount?: number; id: string };
type M = { role: "user" | "assistant"; content: string; products?: P[] };
type Cfg = { name: string; greeting: string; suggestions: string[] };

const KEY = "sy-advisor";

/** AI shopping advisor: a chat that suggests products from our catalogue (app/api/advisor). */
export function Advisor({ cfg }: { cfg: Cfg }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<M[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const { add } = useShop();

  useEffect(() => {
    try { const s = sessionStorage.getItem(KEY); if (s) setMsgs(JSON.parse(s)); } catch {}
    const h = () => setOpen(true);
    window.addEventListener("open-advisor", h);
    return () => window.removeEventListener("open-advisor", h);
  }, []);
  useEffect(() => {
    try { sessionStorage.setItem(KEY, JSON.stringify(msgs.slice(-24))); } catch {}
    end.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [msgs, busy, open]);

  const send = async (q: string) => {
    const t = q.trim();
    if (!t || busy) return;
    setErr("");
    const next: M[] = [...msgs, { role: "user", content: t.slice(0, 1500) }];
    setMsgs(next);
    setText("");
    setBusy(true);
    const r = await fetch("/api/advisor/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next.slice(-20).map(({ role, content }) => ({ role, content })) }) }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) {
      setErr(d.error === "not_configured" ? "The advisor isn't switched on yet. Our pharmacist can help on WhatsApp." : d.error || "Something went wrong, please try again.");
      return;
    }
    setMsgs([...next, { role: "assistant", content: d.reply, products: d.products }]);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Ask ${cfg.name}`}
        className={`fixed bottom-[calc(8.5rem+env(safe-area-inset-bottom))] end-3 z-40 flex h-12 items-center gap-2 rounded-full bg-ink px-4 font-semibold text-white shadow-lg transition hover:scale-105 md:bottom-5 md:end-24 md:h-14 md:px-5 ${open ? "hidden" : ""}`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg>
        <span className="text-sm">Ask AI</span>
      </button>

      {open && (
        <div role="dialog" aria-modal="false" aria-label={cfg.name} className="fixed inset-x-0 bottom-0 z-[60] flex h-[85vh] flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl md:inset-x-auto md:bottom-5 md:end-5 md:h-[640px] md:w-[400px] md:rounded-3xl">
          <div className="flex items-center justify-between gap-3 bg-ink px-5 py-4 text-white">
            <div>
              <p className="font-semibold">{cfg.name}</p>
              <p className="text-xs text-white/70">Suggests products we have in stock</p>
            </div>
            <div className="flex items-center gap-1">
              {msgs.length > 0 && <button onClick={() => { setMsgs([]); setErr(""); }} className="rounded-full px-3 py-2 text-xs text-white/80 hover:bg-white/10">New chat</button>}
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto overscroll-contain bg-[#faf7f8] p-4 text-sm">
            <div className="max-w-[85%] rounded-2xl rounded-ss-sm bg-white p-3 shadow-sm">{cfg.greeting}</div>
            {msgs.length === 0 && (
              <div className="flex flex-wrap gap-2">
                {cfg.suggestions.map((s) => (
                  <button key={s} onClick={() => send(s)} className="rounded-full border border-line bg-white px-3 py-2 text-xs font-semibold hover:border-ink">{s}</button>
                ))}
              </div>
            )}
            {msgs.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
                <div className={`max-w-[88%] whitespace-pre-line rounded-2xl p-3 ${m.role === "user" ? "rounded-se-sm bg-ink text-white" : "rounded-ss-sm bg-white shadow-sm"}`}>{m.content}</div>
                {!!m.products?.length && (
                  <div className="mt-2 space-y-2">
                    {m.products.map((p) => (
                      <div key={p.slug} className="flex items-center gap-3 rounded-2xl bg-white p-2 shadow-sm">
                        <Link href={`/products/${p.slug}/`} onClick={() => setOpen(false)} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-[#f6f1f3]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          {p.image && <img src={p.image} alt="" className="h-full w-full object-contain" />}
                        </Link>
                        <Link href={`/products/${p.slug}/`} onClick={() => setOpen(false)} className="min-w-0 flex-1">
                          <p className="truncate text-xs text-muted">{p.brand}</p>
                          <p className="line-clamp-2 font-semibold leading-snug">{p.name}</p>
                          <p className="text-xs font-semibold">{money(p.price)}{p.compareAt ? <span className="ms-1 text-muted line-through">{money(p.compareAt)}</span> : null}</p>
                        </Link>
                        {(p.variantCount ?? 1) > 1 ? (
                          <Link href={`/products/${p.slug}/`} onClick={() => setOpen(false)} className="shrink-0 rounded-full border border-ink px-3 py-2 text-xs font-semibold">Options</Link>
                        ) : (
                          <button onClick={() => add(p as Parameters<typeof add>[0])} className="shrink-0 rounded-full bg-ink px-3 py-2 text-xs font-semibold text-white">Add</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {busy && <div className="w-fit rounded-2xl bg-white px-4 py-3 shadow-sm"><span className="inline-flex gap-1"><i className="h-2 w-2 animate-bounce rounded-full bg-muted" /><i className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:.15s]" /><i className="h-2 w-2 animate-bounce rounded-full bg-muted [animation-delay:.3s]" /></span></div>}
            {err && <p className="rounded-xl bg-red-50 p-3 text-sale">{err}</p>}
            <div ref={end} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(text); }} className="flex gap-2 border-t border-line p-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <label htmlFor="advisor-q" className="sr-only">Your question</label>
            <input id="advisor-q" value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} placeholder="What are you looking for?" className="min-h-[48px] flex-1 rounded-full border border-line px-4 text-sm outline-none focus:border-ink" />
            <button disabled={busy || !text.trim()} aria-label="Send" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-ink text-white disabled:opacity-40">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden className="rtl-flip"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
            </button>
          </form>
          <p className="bg-white px-4 pb-2 text-center text-[11px] text-muted">AI suggestions, not medical advice. For health questions, book a free call with our pharmacist.</p>
        </div>
      )}
    </>
  );
}
