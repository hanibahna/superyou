"use client";

import { useState } from "react";

export function WholesaleStatus({ id, status: s0 }: { id: string; status: string }) {
  const [s, setS] = useState(s0);
  return (
    <select value={s} onChange={async (e) => { const v = e.target.value; setS(v); await fetch("/api/admin/wholesale/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: v }) }); }} className="rounded-lg border border-line px-2 py-1 text-sm">
      {["new", "contacted", "approved", "declined"].map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}
    </select>
  );
}
