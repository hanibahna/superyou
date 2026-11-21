import { VideoLibraryEditor } from "@/components/admin/VideoLibraryEditor";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";
import { getSettings, getVideoLibrary } from "@/lib/site-store";

export default async function VideosPage() {
  const [lib, tax, all, settings] = await Promise.all([getVideoLibrary(), getTaxonomy(), getAllProducts(), getSettings()]);
  const brands = Array.from(new Set(all.map((p) => p.brand))).sort((a, b) => a.localeCompare(b));
  return <VideoLibraryEditor initial={lib} taxonomy={tax} brands={brands} tiktok={settings.social.tiktok} />;
}
