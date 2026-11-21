import { docRoute } from "@/lib/admin-doc";
import { settingsSchema } from "@/lib/site";
import { saveSettings } from "@/lib/site-store";
export const POST = docRoute(settingsSchema, saveSettings);
