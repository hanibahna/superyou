import { getMargins } from "@/lib/margins";
import { getGrowth } from "@/lib/growth-store";
import { subPct } from "@/lib/every";
import { marginRows } from "@/lib/margins-report";
import { MarginsEditor } from "@/components/admin/MarginsEditor";

export const dynamic = "force-dynamic";

export default async function MarginsPage() {
  const margins = await getMargins();
  const sub = (await getGrowth()).subscribe;
  return <MarginsEditor margins={margins} rows={await marginRows()} subDefault={sub.enabled ? subPct(sub) : 0} />;
}
