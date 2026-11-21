import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminGuard } from "@/lib/admin-auth";
import { normPhone } from "@/lib/wa";
import { allContacts, deleteContact, getContact, saveContact, upsertContact } from "@/lib/whatsapp";

// List / search contacts (paged), or export them all as CSV with ?format=csv.
export async function GET(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").toLowerCase();
  const filter = sp.get("filter") ?? "all";
  let list = await allContacts();
  if (q) list = list.filter((c) => `${c.name} ${c.phone} ${c.email} ${c.tags.join(" ")}`.toLowerCase().includes(q));
  if (filter === "offers") list = list.filter((c) => c.offers);
  if (filter === "out") list = list.filter((c) => !c.offers && c.optOutAt);
  list.sort((a, b) => (b.lastOrderAt ?? b.createdAt).localeCompare(a.lastOrderAt ?? a.createdAt));
  if (sp.get("format") === "csv") {
    const rows = [["phone", "name", "email", "offers", "updates", "orders", "spent", "last_order", "sources", "tags", "brands", "services"], ...list.map((c) => [c.phone, c.name, c.email, c.offers ? "yes" : "no", c.updates ? "yes" : "no", String(c.orders), String(c.spent), c.lastOrderAt ?? "", c.sources.join("|"), c.tags.join("|"), c.brands.slice(0, 20).join("|"), c.services.join("|")])];
    return new NextResponse("﻿" + rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(",")).join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="whatsapp-contacts.csv"' } });
  }
  const page = Math.max(1, Number(sp.get("page") ?? 1));
  const all = await allContacts();
  return NextResponse.json({
    total: list.length, page, items: list.slice((page - 1) * 50, page * 50),
    counts: { all: all.length, offers: all.filter((c) => c.offers).length, out: all.filter((c) => !c.offers && c.optOutAt).length },
  });
}

// Import (rows) or add one contact. Imported contacts are only opted in to offers when you confirm they agreed.
export async function POST(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ rows: z.array(z.object({ phone: z.string(), name: z.string().optional(), email: z.string().optional(), tags: z.array(z.string()).optional() })).max(20000), offers: z.boolean() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid import" }, { status: 400 });
  let ok = 0, bad = 0;
  for (const r of p.data.rows) {
    const res = await upsertContact({ phone: r.phone, name: r.name, email: r.email, tags: r.tags, source: "import", offers: p.data.offers || undefined });
    if (res) ok++; else bad++;
  }
  return NextResponse.json({ ok, bad });
}

// Edit one contact (opt-in, updates, tags, name).
export async function PATCH(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  const p = z.object({ phone: z.string(), name: z.string().max(100).optional(), offers: z.boolean().optional(), updates: z.boolean().optional(), tags: z.array(z.string().max(40)).max(50).optional() }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const c = await getContact(normPhone(p.data.phone));
  if (!c) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const now = new Date().toISOString();
  if (p.data.offers !== undefined && p.data.offers !== c.offers) Object.assign(c, p.data.offers ? { offers: true, optInAt: now } : { offers: false, optOutAt: now });
  if (p.data.updates !== undefined) c.updates = p.data.updates;
  if (p.data.tags) c.tags = p.data.tags;
  if (p.data.name !== undefined) c.name = p.data.name;
  await saveContact(c);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const denied = await adminGuard();
  if (denied) return denied;
  await deleteContact(normPhone(req.nextUrl.searchParams.get("phone") ?? ""));
  return NextResponse.json({ ok: true });
}
