"use client";

// Storefront pieces for the growth features: sign-up pop-up (classic or spin-to-win),
// mobile tab bar, star ratings, free-delivery bar, pharmacist button, language switch,
// recently viewed.

import { ScanIcon } from "./ScanIcon";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { waLink } from "@/lib/growth";
import { LANGS, type Lang } from "@/lib/i18n";
import { money } from "@/lib/format";
import { useGrowth, useLang, useSettings, useT } from "@/lib/site-context";
import { useShop, type ProductSnap } from "@/lib/store";
import { BagIcon, ChatIcon, CloseIcon, GridIcon, HomeIcon, SearchIcon, UserIcon } from "./Icons";
import { ProductCard } from "./ProductCard";
import { celebrate, celebrateLevel } from "./Celebrate";
import { SearchBox } from "./SearchBox";

// ── Storage helpers (never throw: private mode, blocked storage…) ──
const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const set = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

export { Stars } from "./Stars";

// ── Free delivery progress ──
export function FreeDeliveryBar() {
  const g = useGrowth();
  const { delivery } = useSettings();
  const { subtotal, discountTotal } = useShop();
  const t = useT();
  const threshold = delivery.freeThreshold;
  if (!g.freeDeliveryBar || threshold <= 0 || subtotal <= 0) return null;
  const spent = subtotal - discountTotal;
  const remaining = Math.max(0, threshold - spent);
  return (
    <div className="rounded-xl bg-brand-50 px-4 py-3">
      <p className="text-sm">
        {remaining > 0 ? <><b>{money(remaining)}</b> {t("away from free delivery")}</> : <b className="text-brand-700">{t("You've unlocked free delivery")} ✓</b>}
      </p>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
        <div className="h-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (spent / threshold) * 100)}%` }} />
      </div>
    </div>
  );
}

// ── Ask a pharmacist (WhatsApp, pre-filled with the product) ──
export function PharmacistButton({ product, className = "" }: { product?: string; className?: string }) {
  const g = useGrowth();
  const { store } = useSettings();
  const t = useT();
  if (!g.pharmacist.enabled) return null;
  const phone = g.pharmacist.whatsapp || store.whatsapp;
  const text = product ? `Hello, I have a question about ${product}` : "Hello, I'd like advice from a pharmacist";
  return (
    <a href={waLink(phone, text)} target="_blank" rel="noreferrer" className={`flex items-center gap-3 rounded-xl border border-line p-3 text-sm hover:border-ink ${className}`}>
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#25D366] text-white"><ChatIcon width={18} height={18} /></span>
      <span>
        <b className="block">{g.pharmacist.label || t("Ask a pharmacist")}</b>
        <span className="text-xs text-muted">{t("Free pharmacist advice on WhatsApp")} · {store.openingHours || g.pharmacist.hours}</span>
      </span>
    </a>
  );
}

// ── Language switch (cookie, then reload so server pages switch too) ──
export function LangSwitch({ className = "" }: { className?: string }) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);
  const go = (next: Lang) => {
    document.cookie = `lang=${next}; path=/; max-age=31536000; samesite=lax`;
    const { pathname, search } = window.location;
    const plain = pathname.replace(/^\/(ar|fr)(?=\/|$)/, "") || "/";
    window.location.href = (next === "en" ? plain : `/${next}${plain}`) + search;
  };
  const cur = LANGS.find((l) => l.code === lang) ?? LANGS[0];
  return (
    <div ref={ref} className={`relative ${className}`}>
      <button onClick={() => setOpen(!open)} aria-haspopup="listbox" aria-expanded={open} aria-label="Language / Langue / اللغة" className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-bold">
        <span aria-hidden>🌐</span> {cur.short}
      </button>
      {open && (
        <ul role="listbox" className="absolute end-0 top-full z-50 mt-2 w-36 overflow-hidden rounded-xl border border-line bg-white text-sm text-ink shadow-xl">
          {LANGS.map((l) => (
            <li key={l.code}>
              <button role="option" aria-selected={l.code === lang} onClick={() => go(l.code)} className={`flex w-full items-center justify-between px-4 py-2.5 text-start hover:bg-[#f5f5f5] ${l.code === lang ? "font-bold" : ""}`}>
                {l.label} {l.code === lang && <span>✓</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Mobile bottom tab bar ──
export function MobileTabBar() {
  const tx = useT();
  const { count, setDrawerOpen } = useShop();
  const t = useT();
  const path = usePathname();
  const [search, setSearch] = useState(false);
  const scanOn = !!useGrowth().skinScan?.enabled;
  if (path.startsWith("/checkout")) return null;
  const item = "flex h-16 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] font-medium";
  const on = (p: string) => (p === "/" ? path === "/" : path.startsWith(p)) ? "text-ink" : "text-muted";
  return (
    <>
      <nav className="tabbar fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden" aria-label={tx("Shortcuts")}>
        <Link href="/" className={`${item} ${on("/")}`}><HomeIcon width={22} height={22} />{t("Home")}</Link>
        <Link href="/shop/" className={`${item} ${on("/shop")}`}><GridIcon width={22} height={22} />{t("Shop")}</Link>
        {scanOn && (
          <Link href="/skin-scan/" className={`${item} relative -mt-5 text-ink`} aria-label={t("SuperScan")}>
            <span className="scan-glow grid h-14 w-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-white"><ScanIcon size={26} /></span>
            <span className="font-semibold">{t("SuperScan")}</span>
          </Link>
        )}
        {/* The search bar is always at the top on phones: with SuperScan on, its tab gives way so SuperScan sits in the middle. */}
        {!scanOn && <button onClick={() => setSearch(true)} className={`${item} text-muted`}><SearchIcon width={22} height={22} />{t("Search")}</button>}
        <button onClick={() => setDrawerOpen(true)} className={`${item} relative text-muted`}>
          <BagIcon data-bag width={22} height={22} />{t("Bag")}
          {count > 0 && <span className="absolute top-1.5 grid h-4 min-w-4 translate-x-3 place-items-center rounded-full bg-sale px-1 text-[11px] font-bold text-white">{count}</span>}
        </button>
        <Link href="/account/" className={`${item} ${on("/account")}`}><UserIcon width={22} height={22} />{t("Account")}</Link>
      </nav>
      {search && (
        <div className="fixed inset-0 z-50 bg-white p-4 md:hidden">
          <div className="mb-3 flex justify-end"><button onClick={() => setSearch(false)} aria-label="Close search" className="tap px-2"><CloseIcon /></button></div>
          <SearchBox autoFocus onDone={() => setSearch(false)} />
        </div>
      )}
    </>
  );
}

// ── Sign-up pop-up: classic or spin-to-win; permanent tab; cart-exit offer ──
type Result = { code?: string; percent: number; expires: string; index?: number; delivered?: "whatsapp" | "sms" | null };

/** The offer's % counting up with a pop, inside a pulsing ring with floating sparkles. */
function PercentBurst({ value, label }: { value: number; label: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || document.documentElement.dataset.motion === "off";
    if (reduce) return setN(value);
    let raf = 0;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setN(Math.round(value * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="relative grid place-items-center text-center text-white">
      <span className="offer-ring absolute h-44 w-44 rounded-full border-2 border-[#c0587a] md:h-56 md:w-56" aria-hidden />
      <span className="offer-ring absolute h-44 w-44 rounded-full border border-white/40 md:h-56 md:w-56" style={{ animationDelay: "0.8s" }} aria-hidden />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <span key={i} className="offer-spark absolute text-[#e8b4c4]" style={{ left: `${50 + 42 * Math.cos(i * 1.05)}%`, top: `${50 + 42 * Math.sin(i * 1.05)}%`, animationDelay: `${i * 0.25}s` }} aria-hidden>✦</span>
      ))}
      <div className="relative">
        <p className="offer-pop text-6xl font-black tabular-nums md:text-7xl">{n}%</p>
        <p className="mt-2 text-xs uppercase tracking-[0.3em] md:text-sm">{label}</p>
      </div>
    </div>
  );
}

export function SignupPopup() {
  const tx = useT();
  const g = useGrowth().popup;
  const { count } = useShop();
  const t = useT();
  const path = usePathname();
  const [open, setOpen] = useState<null | "popup" | "cart">(null);
  const [channel, setChannel] = useState<"whatsapp" | "sms">("whatsapp");
  const [email, setEmail] = useState("");
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [res, setRes] = useState<Result | null>(null);
  const [spinning, setSpinning] = useState(false);
  const [copied, setCopied] = useState(false);
  const shown = useRef(false);
  const wheelTarget = useRef(0);
  const [landed, setLanded] = useState<number | null>(null);
  const wheelOn = g.wheel.length >= 2;
  const maxWin = Math.max(0, ...g.wheel.map((w) => Number(w.match(/\d+/)?.[0] ?? 0)));
  const blocked = path.startsWith("/checkout") || path.startsWith("/order") || path.startsWith("/pay");

  // Automatic opening: new visitors, after a delay or some scrolling, at most once a week.
  useEffect(() => {
    if (!g.enabled || blocked || get("sy:subscribed")) return;
    const last = Number(get("sy:popup") ?? 0);
    if (Date.now() - last < 7 * 864e5) return;
    const fire = () => {
      if (shown.current) return;
      shown.current = true;
      set("sy:popup", String(Date.now()));
      setOpen("popup");
    };
    const timer = window.setTimeout(fire, g.delaySeconds * 1000);
    const onScroll = () => {
      const h = document.documentElement;
      if (g.scrollPercent > 0 && (h.scrollTop / Math.max(1, h.scrollHeight - h.clientHeight)) * 100 >= g.scrollPercent) fire();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => { window.clearTimeout(timer); window.removeEventListener("scroll", onScroll); };
  }, [g.enabled, g.delaySeconds, g.scrollPercent, blocked]);

  // Cart exit: mouse leaves the top of the window (desktop) with items in the bag, once per session.
  useEffect(() => {
    if (!g.enabled || !g.cartExit || blocked || count === 0) return;
    const onLeave = (e: MouseEvent) => {
      if (e.clientY > 0 || sessionStorage.getItem("sy:exit")) return;
      sessionStorage.setItem("sy:exit", "1");
      setOpen("cart");
    };
    document.addEventListener("mouseout", onLeave);
    return () => document.removeEventListener("mouseout", onLeave);
  }, [g.enabled, g.cartExit, count, blocked]);

  if (!g.enabled || blocked) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await fetch("/api/signup/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: value, via: channel, email: email.trim() || undefined, source: open === "cart" ? "cart" : "popup" }) }).catch(() => null);
    const data = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(data.error ?? tx("Something went wrong, please try again"));
    set("sy:subscribed", "1");
    if (wheelOn && typeof data.index === "number" && data.index >= 0) {
      wheelTarget.current = data.index;
      setLanded(null);
      setRes(null);
      setSpinning(true);
      window.setTimeout(() => { setSpinning(false); setLanded(data.index); }, 4600);
      window.setTimeout(() => setRes(data), 5300);
    } else setRes(data);
  }
  // Celebrate the code the moment it appears (after the wheel stops).
  // The bigger the prize, the bigger the party: 4 confetti levels from the lowest to the top slice.
  useEffect(() => {
    if (landed === null && !res) return;
    const pcts = [...new Set(g.wheel.map((w) => Number(w.match(/\d+/)?.[0] ?? 0)))].sort((a, b) => a - b);
    const won = res?.percent ?? Number(g.wheel[landed ?? 0]?.match(/\d+/)?.[0] ?? 0);
    const rank = Math.max(0, pcts.indexOf(won));
    const level = pcts.length <= 1 ? 2 : 1 + Math.round((rank / (pcts.length - 1)) * 3);
    if (landed !== null && !res) celebrateLevel(level);
    else if (res && landed === null) celebrateLevel(level);
  }, [landed, res]);
  const n = g.wheel.length;
  const close = () => setOpen(null);
  const colors = ["#111", "#c0587a", "#333", "#e8b4c4", "#555", "#f3d9e1", "#222", "#d98aa5", "#444", "#fbe9ef"];

  return (
    <>
      {g.tab && !open && !res && (
        <button onClick={() => setOpen("popup")} className="offer-tab sp-shine fixed bottom-5 start-5 z-30 hidden rounded-full bg-ink px-4 py-3 text-xs font-bold uppercase tracking-wider text-white shadow-lg md:block">
          {wheelOn ? `🎡 ${t("Spin to win")}${maxWin ? ` ${t("up to")} ${maxWin}%` : ""}` : g.tabLabel || t("Get 10% off")}
        </button>
      )}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center md:items-center" role="dialog" aria-modal="true" aria-label={g.title}>
          <div className="absolute inset-0 bg-black/50" onClick={close} />
          <div className="sheet-up relative grid max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white md:max-w-3xl md:grid-cols-2 md:rounded-2xl">
            <button onClick={close} aria-label={tx("Close")} className="absolute end-3 top-3 z-10 rounded-full bg-white/90 p-2"><CloseIcon width={18} height={18} /></button>
            <div className="relative min-h-[220px] bg-ink md:min-h-[380px]">
              {wheelOn ? (
                <div className="absolute inset-0 grid place-items-center overflow-hidden">
                  <div className="wheel-glow absolute h-64 w-64 rounded-full bg-[#c0587a]/30 blur-3xl md:h-80 md:w-80" aria-hidden />
                  <div className="relative mt-3 h-44 w-44 md:mt-0 md:h-72 md:w-72">
                    <div className={`absolute -top-3 left-1/2 z-10 -translate-x-1/2 ${spinning ? "wheel-tick" : ""}`} aria-hidden>
                      <div className="h-0 w-0 border-x-[12px] border-t-[22px] border-x-transparent border-t-white drop-shadow" />
                    </div>
                    <div className={`h-full w-full ${spinning || landed !== null || res ? "" : "wheel-idle"}`}>
                      <svg viewBox="-100 -100 200 200" className={`h-full w-full ${spinning ? "wheel-spin" : ""}`} style={{ ["--wheel-to" as string]: `${360 * 7 - (wheelTarget.current + 0.5) * (360 / n)}deg`, ...(!spinning && (landed !== null || res) ? { transform: `rotate(${360 * 7 - (wheelTarget.current + 0.5) * (360 / n)}deg)` } : {}) }}>
                        <circle r="99" fill="#c0587a" />
                        {g.wheel.map((label, i) => {
                          const a0 = (i / n) * 2 * Math.PI - Math.PI / 2, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2, am = (a0 + a1) / 2;
                          const win = landed === i || (res && wheelTarget.current === i);
                          return (
                            <g key={i} className={win ? "wheel-win" : ""}>
                              <path d={`M0 0L${90 * Math.cos(a0)} ${90 * Math.sin(a0)}A90 90 0 0 1 ${90 * Math.cos(a1)} ${90 * Math.sin(a1)}Z`} fill={colors[i % colors.length]} stroke="#fff" strokeWidth="1.5" />
                              <text x={58 * Math.cos(am)} y={58 * Math.sin(am)} fill={i % 2 ? "#111" : "#fff"} fontSize="12" fontWeight="800" textAnchor="middle" dominantBaseline="middle" transform={`rotate(${(am * 180) / Math.PI + 90} ${58 * Math.cos(am)} ${58 * Math.sin(am)})`}>{label}</text>
                            </g>
                          );
                        })}
                        {Array.from({ length: 16 }, (_, i) => (
                          <circle key={i} className="wheel-bulb" style={{ animationDelay: `${(i % 2) * 0.4}s` }} cx={95 * Math.cos((i / 16) * 2 * Math.PI)} cy={95 * Math.sin((i / 16) * 2 * Math.PI)} r="2.6" fill="#fff" />
                        ))}
                        <circle r="17" fill="#fff" stroke="#c0587a" strokeWidth="3" />
                        <text y="1" fontSize="13" fontWeight="900" textAnchor="middle" dominantBaseline="middle" fill="#c0587a">S</text>
                      </svg>
                    </div>
                  </div>
                </div>
              ) : g.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={g.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 grid place-items-center p-10">
                  <PercentBurst value={open === "cart" && g.cartExitPercent ? g.cartExitPercent : g.percent} label={t("off your first order")} />
                </div>
              )}
            </div>
            <div className="p-6 md:p-8">
              {res ? (
                <div className="offer-reveal text-center md:text-start">
                  <p className="text-xs font-bold uppercase tracking-widest text-sale">{t("You won")}</p>
                  <p className="offer-pop mt-2 text-3xl font-black">{res.percent}% off</p>
                  {res.delivered ? (
                    <p className="mt-4 rounded-lg bg-[#ecfdf3] p-3 text-sm text-[#046c4e]">✓ {res.delivered === "whatsapp" ? t("Your code was sent to you on WhatsApp.") : t("Your code was sent to you by text message.")} {t("Use it at checkout.")}</p>
                  ) : res.code ? (
                    <>
                      <button onClick={() => { navigator.clipboard?.writeText(res.code!); setCopied(true); }} className="mt-4 w-full rounded-lg border-2 border-dashed border-ink py-3 font-mono text-xl font-bold tracking-widest">
                        {res.code} <span className="ms-2 text-xs font-sans font-semibold text-muted">{copied ? t("Copied") : t("Copy")}</span>
                      </button>
                      {/* Keep the code: send it to yourself on the channel you picked. */}
                      {(() => {
                        const msg = `SuperYou: my code ${res.code} gives ${res.percent}% off my first order, until ${res.expires.slice(0, 10)}. ${typeof window !== "undefined" ? window.location.origin : ""}`;
                        return channel === "whatsapp" ? (
                          <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noopener noreferrer" className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#25d366] py-3 text-sm font-semibold text-white">{t("Send the code to my WhatsApp")}</a>
                        ) : (
                          <a href={`sms:?&body=${encodeURIComponent(msg)}`} className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-[#0ea5e9] py-3 text-sm font-semibold text-white">{t("Text the code to myself")}</a>
                        );
                      })()}
                    </>
                  ) : null}
                  <p className="mt-2 text-xs text-muted">{t("Valid until")} {res.expires.slice(0, 10)} · {t("one use, first order, for this phone number.")}</p>
                  <button onClick={close} className="mt-5 w-full rounded-full bg-ink py-3 font-semibold text-white">{t("Shop now")}</button>
                </div>
              ) : (
                <>
                  <h2 className="pe-8 text-2xl font-bold leading-tight">{open === "cart" ? g.cartExitText : g.title}</h2>
                  <p className="mt-2 text-sm text-muted">{g.text}</p>
                  <div className="mt-5 inline-flex rounded-full bg-[#f2f2f2] p-1 text-sm">
                    <button type="button" onClick={() => setChannel("whatsapp")} className={`rounded-full px-4 py-1.5 ${channel === "whatsapp" ? "bg-white font-semibold shadow" : ""}`}>WhatsApp</button>
                    <button type="button" onClick={() => setChannel("sms")} className={`rounded-full px-4 py-1.5 ${channel === "sms" ? "bg-white font-semibold shadow" : ""}`}>{t("Text message")}</button>
                  </div>
                  <form onSubmit={submit} className="mt-3 space-y-3">
                    <input
                      required
                      autoFocus
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      placeholder="70 123 456"
                      aria-label={t("Mobile number (your code is sent here)")}
                      className="tap w-full rounded-lg border border-line px-4 py-3 outline-none focus:border-ink"
                    />
                    <input
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={t("Email (optional) for news and offers")}
                      aria-label={t("Email (optional)")}
                      className="tap w-full rounded-lg border border-line px-4 py-2.5 text-sm outline-none focus:border-ink"
                    />
                    <button disabled={busy || spinning} className="tap w-full rounded-full bg-ink py-3 font-semibold text-white disabled:opacity-60">
                      {spinning ? "…" : wheelOn ? t("Spin the wheel") : t("Get my code")}
                    </button>
                    {err && <p className="text-sm text-sale">{err}</p>}
                  </form>
                  {wheelOn && <p className="mt-3 text-xs text-muted md:hidden">Every spin wins: {g.wheel.join(" · ")}</p>}
                  <p className="mt-4 text-[11px] text-muted">By signing up you agree to receive offers by {channel === "whatsapp" ? "WhatsApp" : "text message"}{email.trim() ? " and email" : ""}. Unsubscribe anytime (reply STOP on WhatsApp).</p>
                  <button onClick={close} className="mt-2 text-xs text-muted underline">{t("No thanks")}</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Referral links: /?ref=REF-XXXX puts the friend's code in the cart ──
export function RefCapture() {
  const { code, setCode } = useShop();
  useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get("ref");
    // Member referral links (REF-…) and influencer codes (/?ref=RANA10) both pre-fill the code.
    if (ref && /^[A-Z0-9-]{3,20}$/i.test(ref)) {
      set("sy:ref", ref.toUpperCase());
      if (!/^REF-/i.test(ref) && !sessionStorage.getItem(`sy:clk:${ref}`)) {
        sessionStorage.setItem(`sy:clk:${ref}`, "1");
        fetch("/api/ref/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: ref }) }).catch(() => {});
      }
    }
    const saved = get("sy:ref");
    if (saved && !code) setCode(saved);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

// ── Scroll reveal: sections and product cards rise in once as they appear ──
export function Motion() {
  const path = usePathname();
  const { count } = useShop();
  const prev = useRef(count);
  useEffect(() => {
    if (document.documentElement.dataset.motion === "off" || matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))), { rootMargin: "0px 0px -8% 0px" });
    const seen = new WeakSet<Element>();
    const tag = () => {
      // A section hidden before its products streamed in: show it now.
      document.querySelectorAll("main .reveal:not(.in)").forEach((el) => el.querySelector(".pcard, .pgrid") && el.classList.add("in"));
      document.querySelectorAll("main .hsec, main section").forEach((el) => {
      // Products are never faded: anything holding product cards shows straight away.
      if (seen.has(el) || el.closest(".bf-hero") || el.querySelector(".pcard, .pgrid")) return;
      seen.add(el);
      // Cards React kept from the previous page may still be waiting to fade in: watch them again.
      if (el.classList.contains("reveal")) return el.classList.contains("in") ? undefined : io.observe(el);
      const r = el.getBoundingClientRect();
      if (r.top < innerHeight) return; // already on screen: leave it
      el.classList.add("reveal");
            io.observe(el);
    });
    };
    tag();
    const mo = new MutationObserver(tag);
    mo.observe(document.querySelector("main") ?? document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
      // Never leave anything hidden when leaving the page.
      document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in"));
    };
  }, [path]);
  // Bag bounce when the count goes up
  useEffect(() => {
    if (count > prev.current) document.querySelectorAll("[data-bag]").forEach((el) => { el.classList.remove("bump"); void (el as HTMLElement).offsetWidth; el.classList.add("bump"); });
    prev.current = count;
  }, [count]);
  return null;
}

// ── Recently viewed ──
const RV = "sy:recent";
export function TrackView({ product }: { product: ProductSnap }) {
  useEffect(() => {
    try {
      const list = (JSON.parse(get(RV) ?? "[]") as ProductSnap[]).filter((p) => p.slug !== product.slug);
      set(RV, JSON.stringify([product, ...list].slice(0, 16)));
    } catch { /* ignore */ }
  }, [product]);
  return null;
}

export function RecentlyViewed({ exclude }: { exclude?: string }) {
  const t = useT();
  const [list, setList] = useState<ProductSnap[]>([]);
  useEffect(() => {
    try { setList((JSON.parse(get(RV) ?? "[]") as ProductSnap[]).filter((p) => p.slug !== exclude).slice(0, 10)); } catch { /* ignore */ }
  }, [exclude]);
  if (!list.length) return null;
  return (
    <section className="container-x py-8">
      <h2 className="mb-4 text-xl font-semibold">{t("Recently viewed")}</h2>
      <div className="no-scrollbar -mx-1 flex gap-3 overflow-x-auto px-1 pb-2">
        {list.map((p) => <div key={p.id} className="w-40 shrink-0 md:w-48"><ProductCard product={p} /></div>)}
      </div>
    </section>
  );
}
