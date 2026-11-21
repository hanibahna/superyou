import { adminGuard } from "@/lib/admin-auth";
import { getTaxonomy, iterateDetailed } from "@/lib/catalog";
import { productToRow, templateHeaders, toCsv } from "@/lib/product-input";

export const maxDuration = 300;

// Streams the whole catalog as CSV (works for tens of thousands of products).
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const tax = await getTaxonomy();
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(enc.encode(toCsv([templateHeaders])));
      for await (const page of iterateDetailed(500)) {
        const body = toCsv(page.map((p) => productToRow(p, tax))).replace(/^﻿/, "");
        controller.enqueue(enc.encode("\r\n" + body));
      }
      controller.close();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
