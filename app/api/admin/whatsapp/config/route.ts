import { docRoute } from "@/lib/admin-doc";
import { waConfigSchema } from "@/lib/wa";
import { saveWaConfig } from "@/lib/whatsapp";
export const POST = docRoute(waConfigSchema, saveWaConfig);
