"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function OrderStatusControl({ id, status, options }: { id: string; status: string; options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [value, setValue] = useState(status);
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <select value={value} onChange={(e) => setValue(e.target.value)} className="rounded-lg border border-line bg-white px-3 py-2 text-sm">
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button
        disabled={busy || value === status}
        onClick={async () => {
          setBusy(true);
          await fetch(`/api/admin/orders/${id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: value }) });
          setBusy(false);
          router.refresh();
        }}
        className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
      >
        Update status
      </button>
    </div>
  );
}
