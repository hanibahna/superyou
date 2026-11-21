import { CartDrawer } from "@/components/CartDrawer";
import { FloatingWidgets, Footer, TrustStrip } from "@/components/Footer";
import { MobileTabBar, Motion, RefCapture, SignupPopup } from "@/components/Growth";
import { AnnouncementBar, Header } from "@/components/Header";
import { getTaxonomy } from "@/lib/catalog";
import { getLang } from "@/lib/i18n-server";
import { translateDeep } from "@/lib/translate";
import { ShopProvider } from "@/lib/store";

// Catalog lives in the database, so pages render on request and always show current data.
export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const taxonomy = await translateDeep(await getTaxonomy(), lang, ["name"]);
  return (
    <ShopProvider>
      <AnnouncementBar />
      <Header taxonomy={taxonomy} />
      <main className="min-h-[60vh]">{children}</main>
      <TrustStrip />
      <Footer categories={taxonomy.categories} />
      <CartDrawer />
      <FloatingWidgets />
      <SignupPopup />
      <RefCapture />
      <Motion />
      <MobileTabBar />
    </ShopProvider>
  );
}
