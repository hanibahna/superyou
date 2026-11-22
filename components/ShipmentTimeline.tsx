"use client";

import { useState } from "react";

// Courier scan history (live tracking). Used on the customer's order page and in the admin.
type Ev = { at: string; text: string; place?: string };
const LABEL = { pending: "Label created", in_transit: "On its way", out_for_delivery: "Out for delivery", delivered: "Delivered", exception: "Needs attention" } as const;
const TONE = { pending: "bg-gray-100 text-gray-700", in_transit: "bg-indigo-50 text-indigo-800", out_for_delivery: "bg-amber-50 text-amber-800", delivered: "bg-green-50 text-green-800", exception: "bg-red-50 text-red-700" } as const;
const STEPS = ["pending", "in_transit", "out_for_delivery", "delivered"] as const;

export function ShipmentTimeline({ status, events, checkedAt, refreshUrl }: { status?: keyof typeof LABEL; events?: Ev[]; checkedAt?: string; refreshUrl?: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [all, setAll] = useState(false);
  if (!status && !refreshUrl) return null;
  const step = status ? STEPS.indexOf(status as (typeof STEPS)[number]) : -1;
  const list = events ?? [];
  const fmt = (s: string) => { const d = new Date(s); return isNaN(+d) ? s : d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); };
  return (
    <div className="mt-3">
      {status && (
        <>
          <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-semibold ${TONE[status]}`}>{LABEL[status]}</span>
          {status !== "exception" && (
            <div className="mt-3 grid grid-cols-4 gap-1" aria-hidden>
              {STEPS.map((s, i) => <div key={s} className={`h-1.5 rounded-full ${i <= step ? "bg-brand-600" : "bg-line"}`} />)}
            </div>
          )}
        </>
      )}
      {list.length > 0 && (
        <ol className="mt-3 space-y-2 border-s border-line ps-3 text-xs">
          {(all ? list : list.slice(0, 4)).map((e, i) => (
            <li key={i} className={i ? "text-muted" : ""}>
              <p className={i ? "" : "font-semibold"}>{e.text}</p>
              <p className="text-muted">{fmt(e.at)}{e.place ? ` · ${e.place}` : ""}</p>
            </li>
          ))}
        </ol>
      )}
      {list.length > 4 && <button onClick={() => setAll(!all)} className="mt-2 py-1 text-xs font-semibold text-brand-700">{all ? "Show less" : `Show all ${list.length} updates`}</button>}
      {refreshUrl && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await fetch(refreshUrl, { method: "POST" }).then((x) => x.json()).catch(() => ({ error: "Network error" }));
              setBusy(false);
              if (r.error) setMsg(r.error);
              else if (!r.status) setMsg("This courier has no live tracking set up (Operations → Couriers).");
              else location.reload();
            }}
            className="rounded-lg border border-line px-3 py-2 text-xs font-semibold"
          >{busy ? "Asking the courier…" : "Refresh tracking"}</button>
          {checkedAt && <span className="text-xs text-muted">Checked {fmt(checkedAt)}</span>}
          {msg && <span className="text-xs text-sale">{msg}</span>}
        </div>
      )}
    </div>
  );
}
