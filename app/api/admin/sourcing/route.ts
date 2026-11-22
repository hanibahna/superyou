import { z } from "zod";
import { docRoute } from "@/lib/admin-doc";
import { saveSourcing } from "@/lib/site-store";

const money = z.coerce.number().min(0).max(1000);
const rule = z.object({
  source: z.string().trim().min(1).max(100),
  label: z.string().trim().max(100),
  origin: z.enum(["local", "international"]),
  country: z.string().trim().max(60),
  daysMin: z.coerce.number().int().min(0).max(90),
  daysMax: z.coerce.number().int().min(0).max(90),
  pricing: z.object({ freightPerItem: money, dutyPct: money, feePct: money, vatPct: money, clearancePerItem: money, marginPct: money }).optional(),
});
export const POST = docRoute(z.object({ preferLocal: z.boolean(), local: z.object({ daysMin: z.coerce.number().int().min(0).max(30), daysMax: z.coerce.number().int().min(0).max(30) }), sources: z.array(rule).max(50) }), saveSourcing);
