import { OperationsEditor } from "@/components/admin/OperationsEditor";
import { TrackingKeys } from "@/components/admin/TrackingKeys";
import { requireAdmin } from "@/lib/admin-auth";
import { getOps } from "@/lib/ops-store";
import { maskedKeys } from "@/lib/tracking";

export default async function OperationsPage() {
  await requireAdmin("settings");
  return (
    <>
      <OperationsEditor initial={await getOps()} emailReady={!!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} />
      <TrackingKeys initial={await maskedKeys()} />
    </>
  );
}
