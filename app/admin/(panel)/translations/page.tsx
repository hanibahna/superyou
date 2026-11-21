import { TranslationsAdmin } from "@/components/admin/TranslationsAdmin";
import { aiReady } from "@/lib/translate";

export default function TranslationsPage() {
  return <TranslationsAdmin aiReady={aiReady()} />;
}
