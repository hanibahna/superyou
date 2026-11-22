import { GrowthEditor } from "@/components/admin/GrowthEditor";
import { getGrowth } from "@/lib/growth-store";

export default async function GrowthPage() {
  return <GrowthEditor initial={await getGrowth()} aiReady={!!(await (await import("@/lib/extras")).anthropicKey())} emailReady={!!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} />;
}
