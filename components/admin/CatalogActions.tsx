"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CatalogActions({ empty }: { empty: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [text, setText] = useState("");

  const run = async (body: object) => {
    setBusy(true);
    await fetch("/api/admin/catalog/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    setConfirming(false);
    setText("");
    router.refresh();
  };

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm">
      <h2 className="font-semibold">Catalog tools</h2>
      <div className="mt-3 space-y-2 text-sm">
        <button disabled={busy} onClick={() => run({ action: "sample" })} className="w-full rounded-lg border border-line px-4 py-2 hover:bg-brand-50 disabled:opacity-50">
          {empty ? "Load sample products" : "Add sample products"}
        </button>
        <button disabled={busy} onClick={() => run({ action: "builtin" })} className="w-full rounded-lg border border-line px-4 py-2 hover:bg-brand-50 disabled:opacity-50">
          {busy ? "Working…" : "Restore built-in catalog"}
        </button>
        <button disabled={busy} onClick={() => window.confirm("Replace menus, collections, pages, homepage, theme and categories with the built-in setup? Your products and orders are not touched.") && run({ action: "builtin-site" })} className="w-full rounded-lg border border-line px-4 py-2 hover:bg-brand-50 disabled:opacity-50">
          Restore built-in design & menus
        </button>
        <a href="/api/admin/catalog/" className="block w-full rounded-lg border border-line px-4 py-2 text-center hover:bg-brand-50">
          Download backup (JSON)
        </a>
        {!confirming ? (
          <button disabled={busy || empty} onClick={() => setConfirming(true)} className="w-full rounded-lg border border-line px-4 py-2 text-sale hover:bg-red-50 disabled:opacity-40">
            Delete all products…
          </button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3">
            <p className="text-xs text-red-800">This permanently deletes every product. Type <b>DELETE</b> to confirm.</p>
            <input value={text} onChange={(e) => setText(e.target.value)} className="mt-2 w-full rounded border border-red-200 px-2 py-1.5" />
            <div className="mt-2 flex gap-2">
              <button disabled={text !== "DELETE" || busy} onClick={() => run({ action: "clear", confirm: "DELETE" })} className="flex-1 rounded bg-sale py-1.5 font-semibold text-white disabled:opacity-40">Delete all</button>
              <button onClick={() => setConfirming(false)} className="flex-1 rounded border border-line bg-white py-1.5">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
