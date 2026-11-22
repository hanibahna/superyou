import { docRoute } from "@/lib/admin-doc";
import { marketingSchema } from "@/lib/marketing";
import { saveMarketing } from "@/lib/site-store";
export const POST = docRoute(marketingSchema, saveMarketing);
