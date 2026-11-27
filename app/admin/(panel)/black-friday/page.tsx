import { bannerReport, bfLines, bfState } from "@/lib/black-friday";
import { BlackFridayEditor } from "@/components/admin/BlackFridayEditor";

export const dynamic = "force-dynamic";

export default async function BlackFridayPage() {
  const [state, lines, banner] = await Promise.all([bfState(), bfLines(), bannerReport()]);
  return <BlackFridayEditor state={state} lines={lines} banner={banner} />;
}
