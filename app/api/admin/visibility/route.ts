import { z } from "zod";
import { docRoute } from "@/lib/admin-doc";
import { saveVisibility } from "@/lib/site-store";
export const POST = docRoute(z.object({ hiddenSources: z.array(z.string().max(100)).max(50), hiddenBrands: z.array(z.string().max(100)).max(5000), hiddenCategories: z.array(z.string().max(60)).max(100).default([]) }), saveVisibility);
