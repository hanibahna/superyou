"use client";

import { useState } from "react";
import type { TrackKeys } from "@/lib/tracking";
import { Card, Header, Text, useSaver } from "./fields";

// Courier tracking connections (Admin → Operations). Saved secrets show as dots.
export function TrackingKeys({ initial }: { initial: TrackKeys }) {
  const [k, setK] = useState(initial);
  const saver = useSaver("/api/admin/tracking-keys/");
  const set = <G extends keyof TrackKeys>(g: G, f: keyof TrackKeys[G], v: string) => (saver.touch(), setK({ ...k, [g]: { ...k[g], [f]: v.trim() } }));
  return (
    <div className="mt-8">
      <Header title="Live shipment tracking" sub="Connect courier systems so each shipped order shows where the parcel is, to you and to the customer, and turns Delivered by itself. Pick the connection per courier in Couriers above." saver={saver} onSave={() => saver.save(k)} />
      <div className="space-y-4">
        <Card title="Aramex" sub="Free with an Aramex business account. Ask your Aramex account manager for API access (user, password, account number and PIN).">
          <div className="grid gap-3 md:grid-cols-3">
            <Text label="API user (email)" value={k.aramex.username} onChange={(v) => set("aramex", "username", v)} />
            <Text label="API password" type="password" value={k.aramex.password} onChange={(v) => set("aramex", "password", v)} />
            <Text label="Account number" value={k.aramex.accountNumber} onChange={(v) => set("aramex", "accountNumber", v)} />
            <Text label="Account PIN" type="password" value={k.aramex.accountPin} onChange={(v) => set("aramex", "accountPin", v)} />
            <Text label="Account entity" value={k.aramex.accountEntity} placeholder="BEY" onChange={(v) => set("aramex", "accountEntity", v.toUpperCase())} />
            <Text label="Country code" value={k.aramex.accountCountryCode} placeholder="LB" onChange={(v) => set("aramex", "accountCountryCode", v.toUpperCase())} />
          </div>
        </Card>
        <Card title="DHL Express" sub="Free key from developer.dhl.com (Shipment Tracking – Unified API). Used for imported parcels sent by DHL.">
          <Text label="API key" type="password" value={k.dhl.apiKey} onChange={(v) => set("dhl", "apiKey", v)} />
        </Card>
        <Card title="17TRACK (any carrier)" sub="One key for 2,000+ carriers: LibanPost, Aramex, DHL, FedEx, UPS, USPS and the US/EU posts. Free tier for a small number of parcels a month, paid plans after. Key from api.17track.net.">
          <Text label="API key" type="password" value={k.track17.apiKey} onChange={(v) => set("track17", "apiKey", v)} />
        </Card>
        <p className="text-xs text-muted">Wakilni, Toters and our own drivers have no public tracking API: their orders keep the tracking link and WhatsApp updates. Ask Wakilni for merchant API access if you want it added.</p>
      </div>
    </div>
  );
}
