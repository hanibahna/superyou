import { RoutineEditor } from "@/components/admin/RoutineEditor";
import { getTaxonomy } from "@/lib/catalog";
import { getRoutine } from "@/lib/site-store";

export default async function RoutineAdminPage() {
  const [cfg, tax] = await Promise.all([getRoutine(), getTaxonomy()]);
  return <RoutineEditor initial={cfg} taxonomy={tax} />;
}
