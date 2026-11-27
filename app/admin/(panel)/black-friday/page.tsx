import { bannerItems, bannerReport, bfLines, bfState, getBanner } from "@/lib/black-friday";
import { BannerPicker } from "@/components/admin/BannerPicker";
import { BlackFridayEditor } from "@/components/admin/BlackFridayEditor";

export const dynamic = "force-dynamic";

export default async function BlackFridayPage() {
  const [state, lines, banner, picks] = await Promise.all([bfState(), bfLines(), bannerReport(), getBanner()]);
  const items = await bannerItems(picks);
  return (
    <div className="space-y-6">
      <BannerPicker initial={{ ...picks, items }} />
      <BlackFridayEditor state={state} lines={lines} banner={banner} />
    </div>
  );
}
