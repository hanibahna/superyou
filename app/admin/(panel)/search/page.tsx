import { SearchEditor } from "@/components/admin/SearchEditor";
import { getSearchSettings } from "@/lib/site-store";

export default async function SearchSettingsPage() {
  return <SearchEditor initial={await getSearchSettings()} />;
}
