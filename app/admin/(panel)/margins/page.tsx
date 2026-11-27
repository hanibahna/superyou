import { getMargins } from "@/lib/margins";
import { marginRows } from "@/lib/margins-report";
import { MarginsEditor } from "@/components/admin/MarginsEditor";

export const dynamic = "force-dynamic";

export default async function MarginsPage() {
  const margins = await getMargins();
  return <MarginsEditor margins={margins} rows={await marginRows()} />;
}
