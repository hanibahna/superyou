"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Card, Num, Text, Toggle } from "./fields";

type Row = { code: string; name: string; handle: string; platform: string; phone: string; email: string; percentOff: number; commission: number; minSubtotal: number; active: boolean; notes: string; paid: number; clicks: number; orders: number; revenue: number; earned: number; pending: number; owed: number; recent: { orderId: string; at: string; net: number; commission: number; status: string }[] };
type Form = Omit<Row, "paid" | "clicks" | "orders" | "revenue" | "earned" | "pending" | "owed" | "recent">;
const blank: Form = { code: "", name: "", handle: "", platform: "Instagram", phone: "", email: "", percentOff: 10, commission: 10, minSubtotal: 0, active: true, notes: "" };
const usd = (n: number) => `$${n.toFixed(2)}`;

export function InfluencersAdmin({ rows, referral, clubOn, site }: { rows: Row[]; referral: { enabled: boolean; friendAmount: number; friendMinSubtotal: number; referrerPoints: number }; clubOn: boolean; site: string }) {
  const [f, setF] = useState<Form | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState("");
  const post = async (body: unknown) => {
    setErr("");
    const r = await fetch("/api/admin/influencers/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) return setErr(d.error || "Could not save");
    location.reload();
  };
  const tot = rows.reduce((a, r) => ({ clicks: a.clicks + r.clicks, orders: a.orders + r.orders, revenue: a.revenue + r.revenue, owed: a.owed + r.owed }), { clicks: 0, orders: 0, revenue: 0, owed: 0 });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Referrals & influencers</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted">Give each influencer a personal code and link. Their followers get a discount; they earn a commission on delivered orders. Customers also refer friends through the Club.</p>
        </div>
        <button onClick={() => setF({ ...blank })} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">+ New influencer</button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Card title="Link visits"><p className="text-3xl font-bold">{tot.clicks}</p></Card>
        <Card title="Orders"><p className="text-3xl font-bold">{tot.orders}</p></Card>
        <Card title="Sales (after discount)"><p className="text-3xl font-bold">{usd(tot.revenue)}</p></Card>
        <Card title="Commission to pay"><p className="text-3xl font-bold">{usd(tot.owed)}</p></Card>
      </div>

      {f && (
        <div className="mt-5">
          <Card title={rows.some((r) => r.code === f.code) ? `Edit ${f.code}` : "New influencer"}>
            <div className="grid gap-3 md:grid-cols-3">
              <Text label="Code (also their link)" value={f.code} onChange={(code) => setF({ ...f, code: code.toUpperCase().replace(/[^A-Z0-9-]/g, "") })} placeholder="RANA10" />
              <Text label="Name" value={f.name} onChange={(name) => setF({ ...f, name })} />
              <Text label="Handle" value={f.handle} onChange={(handle) => setF({ ...f, handle })} placeholder="@rana.beauty" />
              <Text label="Platform" value={f.platform} onChange={(platform) => setF({ ...f, platform })} />
              <Text label="WhatsApp / phone" value={f.phone} onChange={(phone) => setF({ ...f, phone })} />
              <Text label="Email" value={f.email} onChange={(email) => setF({ ...f, email })} />
              <Num label="Follower discount %" value={f.percentOff} onChange={(percentOff) => setF({ ...f, percentOff })} />
              <Num label="Commission % (of sales after discount)" value={f.commission} onChange={(commission) => setF({ ...f, commission })} />
              <Num label="Minimum order $" value={f.minSubtotal} onChange={(minSubtotal) => setF({ ...f, minSubtotal })} />
              <Toggle label="Active" checked={f.active} onChange={(active) => setF({ ...f, active })} />
              <Text label="Notes (contract, payout method)" value={f.notes} onChange={(notes) => setF({ ...f, notes })} className="md:col-span-2" />
            </div>
            {err && <p className="mt-3 text-sm text-sale">{err}</p>}
            <div className="mt-4 flex gap-2">
              <button onClick={() => post({ action: "save", influencer: f })} className="rounded-lg bg-ink px-4 py-2.5 text-sm font-semibold text-white">Save</button>
              <button onClick={() => setF(null)} className="rounded-lg border border-line px-4 py-2.5 text-sm">Cancel</button>
            </div>
          </Card>
        </div>
      )}

      <div className="mt-5">
        <Card title={`Influencers (${rows.length})`}>
          {!rows.length ? <p className="text-sm text-muted">No influencers yet. Add one to get their code and link.</p> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-sm">
                <thead><tr className="text-left text-muted"><th className="py-2">Influencer</th><th>Code & link</th><th>Deal</th><th>Visits</th><th>Orders</th><th>Sales</th><th>Earned / pending</th><th>To pay</th><th></th></tr></thead>
                <tbody className="divide-y divide-line">
                  {rows.map((r) => (
                    <Fragment key={r.code}>
                      <tr className="align-top">
                        <td className="py-3"><b>{r.name}</b>{!r.active && <span className="ms-2 rounded bg-gray-100 px-1.5 text-xs">paused</span>}<br /><span className="text-muted">{r.handle} {r.platform && `· ${r.platform}`}</span></td>
                        <td className="py-3"><code className="font-bold">{r.code}</code><br /><button onClick={() => navigator.clipboard.writeText(`${site}/?ref=${r.code}`)} className="text-xs text-brand-700 underline">Copy link</button></td>
                        <td className="py-3">{r.percentOff}% off · {r.commission}% to them{r.minSubtotal ? ` · min $${r.minSubtotal}` : ""}</td>
                        <td className="py-3">{r.clicks}</td>
                        <td className="py-3">{r.orders}</td>
                        <td className="py-3">{usd(r.revenue)}</td>
                        <td className="py-3">{usd(r.earned)} / <span className="text-muted">{usd(r.pending)}</span></td>
                        <td className="py-3 font-bold">{usd(r.owed)}<br /><span className="text-xs font-normal text-muted">paid {usd(r.paid)}</span></td>
                        <td className="space-y-1 py-3 text-right">
                          <button onClick={() => setF({ code: r.code, name: r.name, handle: r.handle, platform: r.platform, phone: r.phone, email: r.email, percentOff: r.percentOff, commission: r.commission, minSubtotal: r.minSubtotal, active: r.active, notes: r.notes })} className="block w-full rounded-lg border border-line px-2 py-1">Edit</button>
                          {r.owed > 0 && <button onClick={() => confirm(`Mark ${usd(r.owed)} as paid to ${r.name}?`) && post({ action: "pay", code: r.code, amount: r.owed })} className="block w-full rounded-lg bg-ink px-2 py-1 text-white">Mark paid</button>}
                          <button onClick={() => setOpen(open === r.code ? "" : r.code)} className="block w-full rounded-lg px-2 py-1 text-xs text-muted">{open === r.code ? "Hide" : "Orders"}</button>
                          <button onClick={() => confirm(`Delete ${r.code}? The code stops working.`) && post({ action: "delete", code: r.code })} className="block w-full rounded-lg px-2 py-1 text-xs text-sale">Delete</button>
                        </td>
                      </tr>
                      {open === r.code && (
                        <tr><td colSpan={9} className="bg-[#faf7f8] p-3">
                          {!r.recent.length ? <p className="text-muted">No orders yet.</p> : r.recent.map((o) => (
                            <p key={o.orderId} className="py-0.5"><Link className="underline" href={`/admin/orders/${o.orderId}/`}>{o.orderId}</Link> · {o.at.slice(0, 10)} · {usd(o.net)} · commission {usd(o.commission)} · {o.status}</p>
                          ))}
                        </td></tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5">
        <Card title="Customer referrals (SuperYou Club)" sub="Every Club member gets a REF- link in their account. Change these in Growth → Club.">
          <p className="text-sm">{clubOn && referral.enabled ? <>On: the friend gets <b>${referral.friendAmount}</b> off a first order from ${referral.friendMinSubtotal}; the member gets <b>{referral.referrerPoints} points</b> when it's delivered.</> : "Off."} <Link href="/admin/growth/" className="font-semibold underline">Edit</Link></p>
          <p className="mt-2 text-sm text-muted">Shoppers also see a Share button on every product, section and search; when they're Club members the link carries their referral code automatically.</p>
        </Card>
      </div>
    </div>
  );
}
