import { docRoute } from "@/lib/admin-doc";
import { landingSchema, type Landing } from "@/lib/site";
import { saveLanding } from "@/lib/site-store";
export const POST = docRoute(landingSchema, (v) => saveLanding(v as Landing));
