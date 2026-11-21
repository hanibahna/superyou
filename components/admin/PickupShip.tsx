"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PickupShip({ ids, courier, courierName }: { ids: string[]; courier: string; courierName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl bg-white p-4 text-sm shadow-sm">
      <span>Driver picked them up?</span>
      <button
        disabled={busy}
        onClick={async () => {
          if (!confirm(`Mark ${ids.length} orders as shipped with ${courierName}? Each customer gets the "on its way" message.`)) return;
          setBusy(true);
          const res = await fetch("/api/admin/orders/bulk/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status: "shipped", courier }) });
          const data = await res.json().catch(() => ({}));
          setBusy(false);
          setMsg(res.ok ? `${data.done} orders marked as shipped ✓` : data.error ?? "Could not update");
          if (res.ok) router.refresh();
        }}
        className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {busy ? "Updating…" : `Mark all ${ids.length} as shipped with ${courierName}`}
      </button>
      {msg && <span className="text-muted">{msg}</span>}
    </div>
  );
}
