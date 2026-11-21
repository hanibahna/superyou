import { docRoute } from "@/lib/admin-doc";
import { layoutSchema } from "@/lib/layouts";
import { saveLayout } from "@/lib/site-store";
export const POST = docRoute(layoutSchema, saveLayout);
