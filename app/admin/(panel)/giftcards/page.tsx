import { GiftCardsAdmin } from "@/components/admin/GiftCardsAdmin";
import { requireAdmin } from "@/lib/admin-auth";
import { listGiftCards } from "@/lib/giftcards";
import { getOps } from "@/lib/ops-store";

export default async function GiftCardsPage() {
  await requireAdmin("orders");
  const [cards, ops] = await Promise.all([listGiftCards(), getOps()]);
  return <GiftCardsAdmin cards={cards} validMonths={ops.giftCards.validMonths} />;
}
