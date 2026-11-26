import type { NextRequest } from "next/server";
import { POST as webCheckout } from "@/app/api/checkout/route";

// Native app: place an order (same rules as the website checkout), marked as an app order:
// the first app order gets the app welcome discount and app orders earn double Club points.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const next = new Request(req.url, { method: "POST", headers: req.headers, body: JSON.stringify(body && typeof body === "object" ? { ...body, channel: "app" } : body) });
  return webCheckout(next as NextRequest);
}
