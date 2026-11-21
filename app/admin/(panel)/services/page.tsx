import { ServicesEditor } from "@/components/admin/ServicesEditor";
import { getServices } from "@/lib/site-store";

export default async function ServicesAdminPage() {
  return <ServicesEditor initial={await getServices()} />;
}
