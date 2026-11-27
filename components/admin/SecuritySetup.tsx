"use client";

import { useState } from "react";

export function SecuritySetup({ enabled: initial }: { enabled: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [setup, setSetup] = useState<{ secret: string; svg: string } | null>(null);
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const call = async (body: object) => {
    setBusy(true);
    setMsg("");
    const r = await fetch("/api/admin/security/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) setMsg(j.error ?? "Something went wrong");
    return r.ok ? j : null;
  };
  if (enabled)
    return (
      <div className="space-y-3 rounded-2xl border border-line bg-white p-5">
        <p className="font-semibold text-green-700">Authenticator codes are on for your account.</p>
        <p className="text-sm text-muted">To move to a new phone, turn it off with a current code, then set it up again.</p>
        <div className="flex gap-2">
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="Current code" className="w-40 rounded-lg border border-line px-3 py-2" />
          <button disabled={busy} onClick={async () => { const j = await call({ action: "disable", code }); if (j) { setEnabled(false); setCode(""); } }} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold">Turn off</button>
        </div>
        {msg && <p className="text-sm text-sale">{msg}</p>}
      </div>
    );
  return (
    <div className="space-y-4 rounded-2xl border border-line bg-white p-5">
      {!setup ? (
        <>
          <p className="font-semibold">Authenticator codes are off.</p>
          <button disabled={busy} onClick={async () => { const j = await call({ action: "start" }); if (j) setSetup(j); }} className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white">Set up authenticator app</button>
        </>
      ) : (
        <>
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Open your authenticator app and tap <b>Add</b> (+), then <b>Scan a QR code</b>.</li>
            <li>Scan this code. Or choose “Enter a setup key” and type the key below.</li>
            <li>Type the 6-digit code the app shows, then press <b>Turn on</b>.</li>
          </ol>
          <div className="w-[220px]" dangerouslySetInnerHTML={{ __html: setup.svg }} />
          <p className="break-all font-mono text-sm">{setup.secret.replace(/(.{4})/g, "$1 ").trim()}</p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" maxLength={7} placeholder="6-digit code" className="w-40 rounded-lg border border-line px-3 py-2" />
            <button disabled={busy} onClick={async () => { const j = await call({ action: "confirm", code }); if (j) { setEnabled(true); setSetup(null); setCode(""); } }} className="rounded-lg bg-brand-500 px-4 py-2 font-semibold text-white">Turn on</button>
          </div>
          <p className="text-xs text-muted">Keep the setup key somewhere safe (a password manager): it restores the codes on a new phone. If both are lost, the owner can switch the second step off for an account from Vercel (ADMIN_2FA_RESET).</p>
        </>
      )}
      {msg && <p className="text-sm text-sale">{msg}</p>}
    </div>
  );
}
