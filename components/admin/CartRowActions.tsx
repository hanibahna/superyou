"use client";

import { useRouter } from "next/navigation";

export function CartRowActions({ phone, name, link }: { phone: string; name: string; link: string }) {
  const router = useRouter();
  const text = `Hi ${name.split(" ")[0] || ""}! This is SuperYou. We saved the items in your bag here, in case you'd like to finish your order: ${link}`;
  return (
    <div className="flex flex-col items-end gap-1 whitespace-nowrap">
      <a href={`https://wa.me/${phone}?text=${encodeURIComponent(text)}`} target="_blank" className="font-semibold text-brand-700 underline">Message on WhatsApp ↗</a>
      <button onClick={async () => (await fetch("/api/admin/carts/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "delete", phone }) }), router.refresh())} className="text-xs text-muted underline">Remove</button>
    </div>
  );
}
