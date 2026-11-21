import { docRoute } from "@/lib/admin-doc";
import { servicesSchema } from "@/lib/services";
import { saveServices } from "@/lib/site-store";
export const POST = docRoute(servicesSchema, saveServices);
