"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AddressBook } from "@/components/AddressBook";
import { localAddresses, sameAddress, saveLocalAddresses, type Address } from "@/lib/addresses";
import { money } from "@/lib/format";
import { useGrowth, useT } from "@/lib/site-context";
import { useShop } from "@/lib/store";

type Member = { name: string; points: number; lifetimePoints: number; spend: number; tier: string; next?: string; toNext: number; rewards: string[]; ref?: string; history?: { at: string; points: number; reason: string }[] };
type Order = { id: string; createdAt: string; status: string; total: number; lines: { productId: string; name: string; brand: string; qty: number; gift?: boolean }[] };

/** Light account: phone + any order number shows orders, club points and "buy again". No passwords to remember. */
export function AccountView() {
  const tx = useT();
  const t = useT();
  const g = useGrowth();
  const { wishlist } = useShop();
  const [data, setData] = useState<{ member: Member | null; orders: Order[] } | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [creds, setCreds] = useState({ phone: "", order: "" });

  async function load(phone: string, order: string) {
    setBusy(true);
    setErr("");
    const r = await fetch(`/api/club/?phone=${encodeURIComponent(phone)}&order=${encodeURIComponent(order)}`).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setBusy(false);
    if (!r?.ok) return setErr(d.error ?? "Please try again");
    setData(d);
    try { sessionStorage.setItem("sy:acct", JSON.stringify({ phone, order })); } catch { /* ignore */ }
  }
  useEffect(() => {
    try {
      const c = JSON.parse(sessionStorage.getItem("sy:acct") ?? "null");
      if (c) (setCreds(c), load(c.phone, c.order));
    } catch { /* ignore */ }
  }, []);

  return (
    <div className="container-x max-w-3xl py-12">
      <h1 className="text-3xl font-semibold">{t("Account")}</h1>
      {!data ? (
        <form onSubmit={(e) => (e.preventDefault(), load(creds.phone, creds.order))} className="mt-6 max-w-md space-y-3">
          <p className="text-sm text-muted">{tx("Enter the phone number you ordered with and any one of your order numbers (it's in your WhatsApp confirmation).")}</p>
          <input required value={creds.phone} onChange={(e) => setCreds({ ...creds, phone: e.target.value })} inputMode="tel" placeholder={t("Phone number")} className="tap w-full rounded-lg border border-line px-4 outline-none focus:border-ink" />
          <input required value={creds.order} onChange={(e) => setCreds({ ...creds, order: e.target.value })} placeholder={`${t("Order number")} (e.g. SUP-M3K2Q)`} className="tap w-full rounded-lg border border-line px-4 uppercase outline-none focus:border-ink" />
          {err && <p className="text-sm text-sale">{err}</p>}
          <button disabled={busy} className="tap w-full rounded-full bg-ink font-semibold text-white disabled:opacity-60">{t("Find my account")}</button>
          <p className="pt-4 text-sm">{tx("New here?")} <Link href="/club/" className="font-semibold underline">Join {g.club.name}</Link> · <Link href="/wishlist/" className="underline">{t("Wishlist")} ({wishlist.length})</Link></p>
        </form>
      ) : (
        <div className="mt-6 space-y-8">
          {g.club.enabled && (
            data.member ? (
              <div className="rounded-2xl bg-ink p-6 text-white">
                <p className="text-xs uppercase tracking-[0.3em] text-white/60">{g.club.name}</p>
                <p className="mt-1 text-2xl font-bold">{data.member.tier} member · {data.member.name}</p>
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div><p className="text-3xl font-black">{data.member.points}</p><p className="text-white/60">points toward your next ${g.club.rewardValue}</p></div>
                  <div><p className="text-3xl font-black">{money(data.member.spend)}</p><p className="text-white/60">{tx("spent this year")}</p></div>
                  <div><p className="text-3xl font-black">{data.member.rewards.length}</p><p className="text-white/60">vouchers earned</p></div>
                </div>
                <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full bg-white" style={{ width: `${Math.min(100, (data.member.points / g.club.rewardPoints) * 100)}%` }} /></div>
                {data.member.next && <p className="mt-2 text-xs text-white/70">Spend {money(data.member.toNext)} more this year to reach {data.member.next}.</p>}
                {data.member.rewards.length > 0 && <p className="mt-3 text-xs">Your codes: <span className="font-mono">{data.member.rewards.join(" · ")}</span></p>}
              </div>
            ) : (
              <div className="rounded-2xl border border-line p-6">
                <p className="font-semibold">You're not in {g.club.name} yet.</p>
                <Link href="/club/" className="mt-3 inline-block rounded-full bg-ink px-5 py-2 text-sm font-semibold text-white">{t("Join the club")}</Link>
              </div>
            )
          )}
          {g.club.enabled && data.member?.ref && g.club.referral.enabled && <ReferralBox code={data.member.ref} />}
          {g.club.enabled && (data.member?.history?.length ?? 0) > 0 && (
            <details className="rounded-2xl border border-line p-5">
              <summary className="cursor-pointer font-semibold">{tx("Points history")}</summary>
              <ul className="mt-3 divide-y divide-line text-sm">
                {data.member!.history!.map((h, i) => (
                  <li key={i} className="flex justify-between gap-3 py-2"><span><span className="text-muted">{h.at.slice(0, 10)}</span> · {h.reason}</span><b className={h.points < 0 ? "text-sale" : "text-green-700"}>{h.points > 0 ? "+" : ""}{h.points}</b></li>
                ))}
              </ul>
            </details>
          )}
          <MyAddresses phone={creds.phone} order={creds.order} />
          <MyScans phone={creds.phone} order={creds.order} />
          <div>
            <h2 className="mb-3 text-xl font-semibold">{t("Your orders")}</h2>
            <ul className="divide-y divide-line rounded-2xl border border-line">
              {data.orders.map((o) => <OrderRow key={o.id} o={o} />)}
            </ul>
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <button onClick={() => { sessionStorage.removeItem("sy:acct"); setData(null); }} className="text-sm text-muted underline">Sign out</button>
            <button
              onClick={async () => {
                if (!confirm("Delete your account? This removes your Club points, saved addresses and WhatsApp updates. Your past orders stay on record for accounting.")) return;
                const r = await fetch("/api/account/delete/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone: creds.phone, order: creds.order, confirm: true }) }).catch(() => null);
                if (r?.ok) {
                  try { sessionStorage.removeItem("sy:acct"); localStorage.removeItem("sy:addresses"); } catch {}
                  setData(null);
                  alert("Your account has been deleted.");
                } else alert("We couldn't delete it. Please try again or WhatsApp us.");
              }}
              className="text-sm text-sale underline"
            >Delete my account</button>
          </div>
        </div>
      )}
    </div>
  );
}

function OrderRow({ o }: { o: Order }) {
  const tx = useT();
  const t = useT();
  const { addMany } = useShop();
  const [state, setState] = useState("");
  async function again() {
    setState("…");
    const ids = o.lines.filter((l) => !l.gift).map((l) => l.productId);
    const r = await fetch(`/api/products/snaps/?ids=${ids.join(",")}`).catch(() => null);
    const d = r ? await r.json().catch(() => ({ items: [] })) : { items: [] };
    if (d.items?.length) addMany(d.items);
    setState(d.items?.length ? `Added ${d.items.length} to your bag` : tx("These items are no longer available"));
  }
  return (
    <li className="flex flex-wrap items-center gap-3 p-4 text-sm">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{o.id} · {o.createdAt.slice(0, 10)} · {money(o.total)}</p>
        <p className="truncate text-muted">{o.lines.filter((l) => !l.gift).map((l) => `${l.qty}× ${l.name}`).join(", ")}</p>
        <p className="text-xs capitalize text-muted">{o.status.replace(/_/g, " ")}</p>
      </div>
      <button onClick={again} className="rounded-full border border-ink px-4 py-1.5 font-semibold">{t("Buy again")}</button>
      {state && <span className="w-full text-xs text-brand-700">{state}</span>}
    </li>
  );
}

function ReferralBox({ code }: { code: string }) {
  const tx = useT();
  const g = useGrowth();
  const [copied, setCopied] = useState(false);
  // Remember the member's code so every Share button on the site carries it.
  useEffect(() => { try { localStorage.setItem("sy:myref", code); } catch {} }, [code]);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}/?ref=${code}`;
  const msg = `Get $${g.club.referral.friendAmount} off your first SuperYou order with my link: ${link}`;
  return (
    <div className="rounded-2xl bg-brand-50 p-5">
      <p className="font-semibold">{tx("Refer a friend")}</p>
      <p className="mt-1 text-sm">Your friend gets ${g.club.referral.friendAmount} off their first order (from ${g.club.referral.friendMinSubtotal}); you get {g.club.referral.referrerPoints} points when it's delivered.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <code className="rounded-lg bg-white px-3 py-2 text-sm">{code}</code>
        <button onClick={() => (navigator.clipboard?.writeText(link), setCopied(true))} className="rounded-lg border border-ink px-3 py-2 text-sm font-semibold">{copied ? tx("Copied") : tx("Copy")}</button>
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" className="rounded-lg bg-[#25D366] px-3 py-2 text-sm font-semibold text-white">WhatsApp</a>
      </div>
    </div>
  );
}

/** The customer's address book, saved against their phone number (and kept on this device for checkout). */
function MyAddresses({ phone, order }: { phone: string; order: string }) {
  const [list, setList] = useState<Address[] | null>(null);
  const [note, setNote] = useState("");
  useEffect(() => {
    fetch(`/api/account/addresses/?phone=${encodeURIComponent(phone)}&order=${encodeURIComponent(order)}`)
      .then((r) => r.json())
      .then((d) => {
        // Merge with addresses kept on this phone (e.g. from sign-up or an earlier checkout).
        const server: Address[] = d.addresses ?? [];
        const extra = localAddresses().filter((l) => !server.some((x) => sameAddress(x, l)));
        const merged = [...server, ...extra].slice(0, 10);
        setList(merged);
        saveLocalAddresses(merged);
      })
      .catch(() => setList(localAddresses()));
  }, [phone, order]);
  const change = async (next: Address[]) => {
    setList(next);
    saveLocalAddresses(next);
    setNote("Saving…");
    const r = await fetch("/api/account/addresses/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ phone, order, addresses: next }) }).catch(() => null);
    setNote(r?.ok ? "Saved" : "Couldn't save, please try again");
    setTimeout(() => setNote(""), 2000);
  };
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <h2 className="text-xl font-semibold">My addresses</h2>
        {note && <span className="text-xs text-muted">{note}</span>}
      </div>
      {list ? <AddressBook addresses={list} onChange={change} /> : <p className="text-sm text-muted">Loading…</p>}
    </div>
  );
}

/** Saved AI skin scans (results and routine, never the photo), newest first. */
function MyScans({ phone, order }: { phone: string; order: string }) {
  const t = useT();
  const [list, setList] = useState<{ id: string; link: string; createdAt: string; skinType?: string; concerns: string[] }[] | null>(null);
  useEffect(() => {
    fetch(`/api/skin-scan/history/?phone=${encodeURIComponent(phone)}&order=${encodeURIComponent(order)}`).then((r) => (r.ok ? r.json() : { scans: [] })).then((d) => setList(d.scans ?? [])).catch(() => setList([]));
  }, [phone, order]);
  return (
    <section className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{t("My skin scans")}</h2>
        <Link href={list?.[0] ? `/skin-scan/?from=${list[0].id}&t=${new URL(list[0].link, "https://x").searchParams.get("t")}` : "/skin-scan/"} className="scan-glow inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold text-white">{list?.length ? t("Rescan and compare") : t("Take the 3D face scan")}</Link>
      </div>
      {list === null ? <p className="mt-3 text-sm text-muted">{t("Loading…")}</p> : !list.length ? (
        <p className="mt-3 text-sm text-muted">{t("No scans yet. Take the 3D face scan to get your skin type and a routine from products in stock.")}</p>
      ) : (
        <ul className="mt-3 divide-y divide-line rounded-2xl border border-line">
          {list.map((s) => (
            <li key={s.id}><Link href={s.link} className="flex items-center justify-between gap-3 p-4 hover:bg-[#faf7f8]">
              <span><b>{s.skinType} {t("skin")}</b>{s.concerns.length ? <span className="text-muted"> · {s.concerns.join(" · ")}</span> : null}</span>
              <span className="shrink-0 text-sm text-muted">{new Date(s.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} →</span>
            </Link></li>
          ))}
        </ul>
      )}
    </section>
  );
}
