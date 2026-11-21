import { docRoute } from "@/lib/admin-doc";
import { promotionsSchema } from "@/lib/site";
import { savePromotions } from "@/lib/site-store";
export const POST = docRoute(promotionsSchema, savePromotions);
