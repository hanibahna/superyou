import { NextResponse } from "next/server";
import { z } from "zod";
import { emailPricingCheck } from "@/lib/pricing-email";
import { REPORT_TO } from "@/lib/neo-sync";
import { sendEmail } from "@/lib/email";

export const maxDuration = 120;

// Admin only (the proxy checks /api/admin/* for a signed-in staff member with the "settings" area).
// No body: the pricing check. {guide:{subject,text}}: a pricing guide, sent only to the report addresses.
const Guide = z.object({ guide: z.object({ subject: z.string().min(1).max(200), text: z.string().min(1).max(60000) }) });
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const g = Guide.safeParse(body);
  if (g.success) {
    const sent: boolean[] = [];
    for (const to of REPORT_TO) sent.push(await sendEmail(to, g.data.guide.subject, g.data.guide.text, [{ filename: "superyou-pricing-guide.txt", content: Buffer.from("\ufeff" + g.data.guide.text, "utf8").toString("base64") }]).catch(() => false));
    return NextResponse.json({ sent, to: REPORT_TO });
  }
  return NextResponse.json(await emailPricingCheck());
}
