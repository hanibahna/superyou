import { SettingsEditor } from "@/components/admin/SettingsEditor";
import { getSettings } from "@/lib/site-store";

export default async function SettingsPage() {
  return <SettingsEditor initial={await getSettings()} />;
}
