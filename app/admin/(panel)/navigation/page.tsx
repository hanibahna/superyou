import { NavigationEditor } from "@/components/admin/NavigationEditor";
import { getTaxonomy } from "@/lib/catalog";
import { getSettings } from "@/lib/site-store";

export default async function NavigationPage() {
  const [settings, tax] = await Promise.all([getSettings(), getTaxonomy()]);
  return <NavigationEditor initial={settings} taxonomy={tax} />;
}
