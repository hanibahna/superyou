import { requireAdmin } from "@/lib/admin-auth";
import { listCash, listPayables } from "@/lib/fulfil";
import { PayablesView } from "@/components/admin/PayablesView";

// What we owe the supplier for delivered orders, and the cash the courier collected for us.
export default async function Payables() {
  await requireAdmin("orders");
  const [pay, cash] = await Promise.all([listPayables(), listCash()]);
  return <PayablesView pay={pay} cash={cash} />;
}
