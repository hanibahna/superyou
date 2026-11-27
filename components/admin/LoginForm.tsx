"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [needCode, setNeedCode] = useState(false);
  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const f = new FormData(e.currentTarget);
        const res = await fetch("/api/admin/login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: f.get("email"), password: f.get("password"), code: f.get("code") || undefined }) });
        if (res.ok) window.location.href = "/admin/";
        else {
          const j = (await res.json().catch(() => ({}))) as { error?: string; need2fa?: boolean };
          if (j.need2fa) setNeedCode(true);
          setError(j.error ?? "Sign in failed");
          setBusy(false);
        }
      }}
    >
      <input name="email" type="email" autoComplete="username" placeholder="Email (staff only — owner leaves this empty)" className="w-full rounded-lg border border-line px-4 py-3 outline-none focus:border-brand-500" />
      <input name="password" type="password" required autoComplete="current-password" placeholder="Password" className="w-full rounded-lg border border-line px-4 py-3 outline-none focus:border-brand-500" />
      {needCode && (
        <input name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,7}" maxLength={7} autoFocus placeholder="6-digit code from your authenticator app" className="w-full rounded-lg border border-line px-4 py-3 tracking-widest outline-none focus:border-brand-500" />
      )}
      {error && <p className="text-sm text-sale">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-brand-500 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
