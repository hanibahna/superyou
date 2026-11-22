import { AppEditor } from "@/components/admin/AppEditor";
import { MASK } from "@/lib/marketing";
import { getAppSettings, tokenStats } from "@/lib/push";

export default async function AppPage() {
  const [s, stats] = await Promise.all([getAppSettings(), tokenStats()]);
  return <AppEditor hasKey={!!s.serviceAccount} mask={MASK} stats={stats} log={s.log} />;
}
