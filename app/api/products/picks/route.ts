import { NextResponse } from "next/server";
import { cardsFor } from "@/lib/listing";

// A few in-stock best-sellers (the "favorite" tag, else the deepest deals) for places with nothing to show,
// such as the empty bag.
export async function GET() {
  let items = (await cardsFor({ kind: "tag", value: "favorite" }, 24, "featured")).filter((c) => c.inStock && c.image);
  if (items.length < 4) items = (await cardsFor({ kind: "sale", value: "" }, 24, "discount")).filter((c) => c.inStock && c.image);
  return NextResponse.json({ items: items.slice(0, 12) }, { headers: { "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600" } });
}
