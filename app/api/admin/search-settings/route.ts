import { docRoute } from "@/lib/admin-doc";
import { searchSettingsSchema } from "@/lib/site";
import { saveSearchSettings } from "@/lib/site-store";
export const POST = docRoute(searchSettingsSchema, saveSearchSettings);
