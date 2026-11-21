"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Staff = { email: string; name: string; role: string; active: boolean; createdAt: string; lastLoginAt?: string };
type RoleOpt = { value: string; label: string; about: string };
const input = "w-full rounded-lg border border-line px-3 py-2 text-sm";

function genPassword() {
  const A = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const b = crypto.getRandomValues(new Uint8Array(14));
  return [...b].map((x) => A[x % A.length]).join("");
}

export function StaffAdmin({ staff, roles }: { staff: Staff[]; roles: RoleOpt[] }) {
  const router = useRouter();
  const [f, setF] = useState({ name: "", email: "", role: roles[0]?.value ?? "orders", password: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [shown, setShown] = useState<{ email: string; password: string } | null>(null);

  async function post(body: Record<string, unknown>, okText = "Saved ✓") {
    setMsg(null);
    const res = await fetch("/api/admin/staff/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: data.error ?? "Could not save" });
    if (res.ok) router.refresh();
    return res.ok;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">Add a staff member</h2>
        <div className="mt-3 grid gap-3 md:grid-cols-4">
          <label className="text-sm"><span className="mb-1 block font-medium">Name</span><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Email (their login)</span><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={input} /></label>
          <label className="text-sm"><span className="mb-1 block font-medium">Role</span>
            <select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} className={input}>{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select>
          </label>
          <label className="text-sm"><span className="mb-1 block font-medium">Password</span>
            <div className="flex gap-1"><input value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={`${input} font-mono`} placeholder="10+ characters" /><button type="button" onClick={() => setF({ ...f, password: genPassword() })} className="rounded-lg border border-line px-2 text-xs">Make one</button></div>
          </label>
        </div>
        <p className="mt-2 text-xs text-muted">{roles.find((r) => r.value === f.role)?.about}</p>
        <div className="mt-3 flex items-center gap-3">
          <button
            onClick={async () => {
              if (await post({ action: "add", ...f }, "Added ✓")) (setShown({ email: f.email, password: f.password }), setF({ ...f, name: "", email: "", password: "" }));
            }}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white"
          >Add</button>
          {msg && <span className={`text-sm ${msg.ok ? "text-brand-600" : "text-sale"}`}>{msg.text}</span>}
        </div>
        {shown && (
          <p className="mt-3 rounded-lg bg-brand-50 p-3 text-sm">Give them: <b>{shown.email}</b> / <span className="select-all font-mono">{shown.password}</span> — shown only once. They can&apos;t change it themselves yet, so you can reset it below anytime.</p>
        )}
      </section>

      <section className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-sm">
          <thead className="border-b border-line text-left text-xs text-muted"><tr><th className="p-3">Name</th><th className="p-3">Role</th><th className="p-3">Last sign-in</th><th className="p-3">Status</th><th className="p-3" /></tr></thead>
          <tbody className="divide-y divide-line">
            <tr><td className="p-3 font-medium">Owner<span className="block text-xs text-muted">password set in Vercel (ADMIN_PASSWORD)</span></td><td className="p-3">Owner</td><td className="p-3 text-muted">—</td><td className="p-3">Active</td><td /></tr>
            {staff.map((s) => (
              <tr key={s.email} className={s.active ? "" : "opacity-60"}>
                <td className="p-3 font-medium">{s.name}<span className="block text-xs text-muted">{s.email}</span></td>
                <td className="p-3">
                  <select defaultValue={s.role} onChange={(e) => post({ action: "update", email: s.email, role: e.target.value })} className="rounded border border-line px-2 py-1" aria-label={`Role for ${s.name}`}>
                    {roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </td>
                <td className="p-3 text-muted">{s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Beirut" }) : "Never"}</td>
                <td className="p-3">{s.active ? "Active" : "Switched off"}</td>
                <td className="space-x-3 whitespace-nowrap p-3 text-right">
                  <button onClick={async () => { const pw = genPassword(); if (await post({ action: "update", email: s.email, password: pw }, "Password reset ✓")) setShown({ email: s.email, password: pw }); }} className="text-brand-700 underline">Reset password</button>
                  <button onClick={() => post({ action: "update", email: s.email, active: !s.active })} className="underline">{s.active ? "Switch off" : "Switch on"}</button>
                  <button onClick={() => confirm(`Remove ${s.name}?`) && post({ action: "remove", email: s.email }, "Removed ✓")} className="text-sale underline">Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <p className="text-xs text-muted">Changing someone&apos;s role, password or switching them off signs them out straight away.</p>
    </div>
  );
}
