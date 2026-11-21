"use client";

import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mt-5 space-y-3"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        const password = new FormData(e.currentTarget).get("password");
        const res = await fetch("/api/admin/login/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
        if (res.ok) window.location.href = "/admin/";
        else {
          setError((await res.json()).error ?? "Sign in failed");
          setBusy(false);
        }
      }}
    >
      <input name="password" type="password" required autoFocus placeholder="Password" className="w-full rounded-lg border border-line px-4 py-3 outline-none focus:border-brand-500" />
      {error && <p className="text-sm text-sale">{error}</p>}
      <button disabled={busy} className="w-full rounded-lg bg-brand-500 py-3 font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
