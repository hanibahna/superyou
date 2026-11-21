import type { Metadata } from "next";
import { GiftCardBuy } from "@/components/GiftCardBuy";
import { GIFT_AMOUNTS } from "@/lib/giftcard-sale";
import { getOps } from "@/lib/ops-store";
import { checkoutMethods } from "@/lib/payments";
import { canonical } from "@/lib/seo";

export const dynamic = "force-dynamic";
export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Gift cards",
    description: "Send a SuperYou gift card by WhatsApp or email — skin care, make up, fragrance and more, delivered across Lebanon.",
    ...(await canonical("/gift-cards/")),
  };
}

export default async function GiftCardsPage() {
  const [ops, methods] = await Promise.all([getOps(), checkoutMethods()]);
  return <GiftCardBuy amounts={GIFT_AMOUNTS} methods={methods} enabled={ops.giftCards.enabled} validMonths={ops.giftCards.validMonths} />;
}
