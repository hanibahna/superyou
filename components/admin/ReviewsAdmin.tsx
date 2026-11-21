"use client";

import { useState } from "react";
import type { Review } from "@/lib/growth-store";

export function ReviewsAdmin({ initial }: { initial: Review[] }) {
  const [list, setList] = useState(initial);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [reply, setReply] = useState<Record<string, string>>({});
  async function patch(r: Review, body: Partial<Review>) {
    const res = await fetch("/api/admin/reviews/", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: r.slug, id: r.id, ...body }) });
    if (res.ok) setList((l) => l.map((x) => (x.id === r.id ? { ...x, ...body } : x)));
  }
  async function del(r: Review) {
    if (!confirm("Delete this review for good?")) return;
    await fetch(`/api/admin/reviews/?slug=${encodeURIComponent(r.slug)}&id=${r.id}`, { method: "DELETE" });
    setList((l) => l.filter((x) => x.id !== r.id));
  }
  const shown = list.filter((r) => filter === "all" || r.status === filter);
  const count = (s: string) => list.filter((r) => r.status === s).length;
  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold">Reviews</h1>
      <p className="mb-5 text-sm text-muted">Approve reviews before they appear, and reply as a pharmacist. Settings: Growth & loyalty → Reviews.</p>
      <div className="mb-4 flex gap-2">
        {(["pending", "approved", "rejected", "all"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-4 py-1.5 text-sm capitalize ${filter === f ? "bg-ink text-white" : "bg-white"}`}>{f}{f !== "all" ? ` (${count(f)})` : ""}</button>
        ))}
      </div>
      {shown.length === 0 && <p className="rounded-xl bg-white p-6 text-muted">Nothing here.</p>}
      <ul className="space-y-3">
        {shown.map((r) => (
          <li key={r.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <a href={`/products/${r.slug}/#reviews`} target="_blank" className="text-xs font-semibold text-brand-600 hover:underline">{r.product}</a>
                <p className="mt-1 font-semibold">{"★".repeat(r.rating)}{"☆".repeat(5 - r.rating)} {r.title}</p>
                <p className="text-xs text-muted">{r.name}{r.skinType ? ` · ${r.skinType}` : ""} · {r.createdAt.slice(0, 16).replace("T", " ")}{r.verified ? " · ✓ Verified buyer" : ""}</p>
              </div>
              <div className="flex gap-2 text-sm">
                {r.status !== "approved" && <button onClick={() => patch(r, { status: "approved" })} className="rounded-lg bg-green-600 px-3 py-1 font-semibold text-white">Approve</button>}
                {r.status !== "rejected" && <button onClick={() => patch(r, { status: "rejected" })} className="rounded-lg border border-line px-3 py-1">Reject</button>}
                <button onClick={() => del(r)} className="px-2 text-sale">Delete</button>
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{r.body}</p>
            <div className="mt-3 flex gap-2">
              <input value={reply[r.id] ?? r.reply ?? ""} onChange={(e) => setReply({ ...reply, [r.id]: e.target.value })} placeholder="Pharmacist reply (shown under the review)" className="flex-1 rounded-lg border border-line px-3 py-1.5 text-sm" />
              <button onClick={() => patch(r, { reply: reply[r.id] ?? r.reply ?? "" })} className="rounded-lg border border-line px-3 text-sm">Save reply</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
