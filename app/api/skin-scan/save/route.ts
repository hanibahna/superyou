import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { sendEmail } from "@/lib/email";
import { limited } from "@/lib/ratelimit";
import { getScan, routineText, savedScanSchema, saveScan, scanLink } from "@/lib/scans";

// Save a skin scan (no photo) and send it to the customer on WhatsApp and/or email.
export async function POST(req: NextRequest) {
  const tooMany = await limited(req, "scansave", 10);
  if (tooMany) return tooMany;
  const p = savedScanSchema.extend({
    name: z.string().trim().max(60).default(""),
    phone: z.string().trim().max(30).default(""),
    email: z.string().trim().max(120).default(""),
    consent: z.literal(true),
  }).safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "Please add your WhatsApp number or email" }, { status: 400 });
  const d = p.data;
  const phone = d.phone.replace(/[^\d+]/g, "");
  if (!phone && !/^\S+@\S+\.\S+$/.test(d.email)) return NextResponse.json({ error: "Please add your WhatsApp number or email" }, { status: 400 });
  const s = await saveScan({ analysis: d.analysis, steps: d.steps, name: d.name, phone, email: d.email });
  const link = scanLink(s);
  let whatsapp = false, email = false;
  if (phone) whatsapp = await (await import("@/lib/whatsapp")).trigger("skinScanResult", phone, { first_name: d.name.split(" ")[0] || "there", skin_type: (s.analysis.skinType ?? "").toLowerCase(), routine: routineText(s).slice(0, 900), link }).catch(() => false);
  if (d.email) email = await sendEmail(d.email, "Your SuperYou skin scan and routine", `Hi ${d.name.split(" ")[0] || "there"},\n\nYour skin today: ${s.analysis.skinType ?? ""} skin${s.analysis.concerns.length ? `, focus on ${s.analysis.concerns.join(", ")}` : ""}.\n\nYour routine:\n${routineText(s)}\n\nSee it with the products and add them to your bag: ${link}\n\nTake a new scan in 6 weeks to see your progress.\n\nThis is a cosmetic AI assessment, not a medical diagnosis.\n\nSuperYou · shopsuperyou.com`).catch(() => false);
  return NextResponse.json({ ok: true, link: `/skin-scan/r/${s.id}/?t=${s.token}`, whatsapp, email });
}

// A saved scan by its private link (for comparing when rescanning).
export async function GET(req: NextRequest) {
  const s = await getScan(req.nextUrl.searchParams.get("id") ?? "");
  const t = req.nextUrl.searchParams.get("t") ?? "";
  if (!s || t.length !== s.token.length || !timingSafeEqual(Buffer.from(t), Buffer.from(s.token))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ createdAt: s.createdAt, analysis: s.analysis });
}
