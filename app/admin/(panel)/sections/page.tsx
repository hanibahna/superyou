import { SectionsEditor } from "@/components/admin/SectionsEditor";
import { getTaxonomy } from "@/lib/catalog";
import { getExtras } from "@/lib/extras";
import { MASK } from "@/lib/marketing";

export default async function SectionsPage() {
  const [e, tax] = await Promise.all([getExtras(), getTaxonomy()]);
  return <SectionsEditor initial={{ ...e, youtube: { ...e.youtube, key: e.youtube.key ? MASK : "" } }} categories={tax.categories.map((c) => ({ slug: c.slug, name: c.name }))} aiReady={!!process.env.ANTHROPIC_API_KEY} />;
}
