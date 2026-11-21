import { docRoute } from "@/lib/admin-doc";
import { collectionsSchema } from "@/lib/site";
import { saveCollections } from "@/lib/site-store";
export const POST = docRoute(collectionsSchema, saveCollections);
