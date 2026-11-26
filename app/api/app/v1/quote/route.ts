import type { NextRequest } from "next/server";
import { POST as webQuote } from "@/app/api/cart/quote/route";

// Native app: live bag prices, discounts and delivery (same as the website bag), with the app welcome discount.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const next = new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(body && typeof body === "object" ? { ...body, channel: "app" } : body) });
  return webQuote(next as NextRequest);
}
