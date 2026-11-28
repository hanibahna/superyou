import { GrowthEditor } from "@/components/admin/GrowthEditor";
import { PricingTabs } from "@/components/admin/PricingTabs";
import { getGrowth } from "@/lib/growth-store";

export const dynamic = "force-dynamic";

export default async function SuperPricePage() {
  return (
    <div>
      <PricingTabs />
      <GrowthEditor only="Price match" initial={await getGrowth()} aiReady={!!(await (await import("@/lib/extras")).anthropicKey())} emailReady={!!(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)} />
    </div>
  );
}
