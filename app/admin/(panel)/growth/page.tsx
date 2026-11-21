import { GrowthEditor } from "@/components/admin/GrowthEditor";
import { getGrowth } from "@/lib/growth-store";

export default async function GrowthPage() {
  return <GrowthEditor initial={await getGrowth()} aiReady={!!process.env.ANTHROPIC_API_KEY} emailReady={!!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} />;
}
