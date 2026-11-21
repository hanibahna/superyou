import { OperationsEditor } from "@/components/admin/OperationsEditor";
import { requireAdmin } from "@/lib/admin-auth";
import { getOps } from "@/lib/ops-store";

export default async function OperationsPage() {
  await requireAdmin("settings");
  return <OperationsEditor initial={await getOps()} emailReady={!!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} />;
}
