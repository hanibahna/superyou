"use client";

import { useState } from "react";
import type { Ops } from "@/lib/ops";
import { Area, Card, Header, Num, Text, Toggle, useSaver } from "./fields";

export function OperationsEditor({ initial, emailReady }: { initial: Ops; emailReady: boolean }) {
  const [o, setO] = useState(initial);
  const saver = useSaver("/api/admin/operations/");
  const up = <K extends keyof Ops>(k: K, patch: Partial<Ops[K]>) => (saver.touch(), setO((x) => ({ ...x, [k]: { ...(x[k] as object), ...patch } })));
  const setCouriers = (couriers: Ops["couriers"]) => (saver.touch(), setO((x) => ({ ...x, couriers })));

  return (
    <div className="space-y-5">
      <Header title="Operations" sub="Stock alerts, couriers, invoices, gift cards and abandoned-cart reminders." saver={saver} onSave={() => saver.save(o)} />

      <Card title="Stock" sub="Counts are taken off when an order is placed.">
        <div className="grid gap-4 md:grid-cols-3">
          <Num label="Low-stock alert at" hint="Alert when a product drops to this many or fewer." value={o.stock.lowAt} onChange={(lowAt) => up("stock", { lowAt })} />
          <Text label="Send alerts to (email)" hint={emailReady ? "Empty = the store email in Settings." : "Email sending isn't set up yet (RESEND_API_KEY and EMAIL_FROM in Vercel). Low stock still shows on the dashboard."} value={o.stock.alertEmail} onChange={(alertEmail) => up("stock", { alertEmail })} />
          <Toggle label="Put stock back when an order is cancelled" checked={o.stock.restockOnCancel} onChange={(restockOnCancel) => up("stock", { restockOnCancel })} />
        </div>
      </Card>

      <Card title="Couriers" sub="Pick one when you ship an order. Tracking link: paste the courier's tracking page address with {tracking} where the number goes, e.g. https://courier.com/track?n={tracking}. Leave it empty if they don't have one.">
        <div className="space-y-2">
          {o.couriers.map((c, i) => (
            <div key={i} className="grid items-end gap-2 md:grid-cols-[1fr_1fr_2fr_40px]">
              <Text label={i ? "" : "Name"} value={c.name} onChange={(name) => setCouriers(o.couriers.map((x, j) => (j === i ? { ...x, name, id: x.id || name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30) } : x)))} />
              <Text label={i ? "" : "Phone"} value={c.phone} onChange={(phone) => setCouriers(o.couriers.map((x, j) => (j === i ? { ...x, phone } : x)))} />
              <Text label={i ? "" : "Tracking link"} value={c.trackingUrl} placeholder="https://…{tracking}" onChange={(trackingUrl) => setCouriers(o.couriers.map((x, j) => (j === i ? { ...x, trackingUrl } : x)))} />
              <button onClick={() => setCouriers(o.couriers.filter((_, j) => j !== i))} className="pb-2 text-sale" aria-label={`Remove ${c.name}`}>✕</button>
            </div>
          ))}
          <button onClick={() => setCouriers([...o.couriers, { id: `courier-${o.couriers.length + 1}`, name: "", phone: "", trackingUrl: "" }])} className="text-sm font-semibold text-brand-600">+ Add courier</button>
        </div>
      </Card>

      <Card title="Invoices">
        <div className="grid gap-4 md:grid-cols-3">
          <Text label="Title" value={o.invoice.title} onChange={(title) => up("invoice", { title })} />
          <Text label="Registered business name" hint="Empty = the store name." value={o.invoice.businessName} onChange={(businessName) => up("invoice", { businessName })} />
          <Text label="Tax / MOF number" value={o.invoice.taxId} onChange={(taxId) => up("invoice", { taxId })} />
          <Area label="Footer" value={o.invoice.footer} onChange={(footer) => up("invoice", { footer })} className="md:col-span-3" />
        </div>
      </Card>

      <Card title="Gift cards">
        <div className="grid gap-4 md:grid-cols-3">
          <Toggle label="Accept gift cards at checkout" checked={o.giftCards.enabled} onChange={(enabled) => up("giftCards", { enabled })} />
          <Num label="Valid for (months, 0 = never expires)" value={o.giftCards.validMonths} onChange={(validMonths) => up("giftCards", { validMonths })} />
        </div>
      </Card>

      <Card title="Abandoned carts" sub="Shoppers who type their mobile at checkout and agree to WhatsApp offers, but don't order, get one reminder (WhatsApp automation &quot;Forgot something?&quot;).">
        <div className="grid gap-4 md:grid-cols-3">
          <Toggle label="Send reminders" checked={o.carts.enabled} onChange={(enabled) => up("carts", { enabled })} />
          <Num label="Send after (hours)" step={0.5} value={o.carts.afterHours} onChange={(afterHours) => up("carts", { afterHours })} />
          <Num label="Don't send after (hours)" hint="Carts older than this are not reminded." value={o.carts.maxAgeHours} onChange={(maxAgeHours) => up("carts", { maxAgeHours })} />
        </div>
      </Card>
    </div>
  );
}
