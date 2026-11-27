import { bannerItems, bannerReport, bfLines, bfState, getBanner } from "@/lib/black-friday";
import { BannerPicker } from "@/components/admin/BannerPicker";
import { BfTestAi } from "@/components/admin/BfTestAi";
import { testStatus } from "@/lib/bf-test";
import { BlackFridayEditor } from "@/components/admin/BlackFridayEditor";

export const dynamic = "force-dynamic";

export default async function BlackFridayPage() {
  const [state, lines, banner, picks] = await Promise.all([bfState(), bfLines(), bannerReport(), getBanner()]);
  const items = await bannerItems(picks);
  const test = await testStatus();
  return (
    <div className="space-y-6">
      <BfTestAi test={test} />
      <BannerPicker key={JSON.stringify(picks)} initial={{ ...picks, items }} />
      <BlackFridayEditor key={JSON.stringify(state)} state={state} lines={lines} banner={banner} />
    </div>
  );
}
