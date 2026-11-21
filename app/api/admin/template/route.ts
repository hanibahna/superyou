import { adminGuard } from "@/lib/admin-auth";
import { templateHeaders, toCsv } from "@/lib/product-input";

export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const example = [
    "SKU-0001", "Hydrating Serum", "14.40", "24.00", "Brand name", "Skincare", "Dryness | Sensitive Skin", "30 ml",
    "25", "active", "deal | new", "https://example.com/image-1.jpg | https://example.com/image-2.jpg",
    "What it does and who it's for.", "Apply morning and evening.", "Aqua, Glycerin, …", "1234567890123",
  ];
  return new Response(toCsv([templateHeaders, example]), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="product-import-template.csv"' },
  });
}
