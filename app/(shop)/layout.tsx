import { Advisor } from "@/components/Advisor";
import { CartDrawer } from "@/components/CartDrawer";
import { anthropicKey, getExtras } from "@/lib/extras";
import { shopImgDeep } from "@/lib/img-server";
import { FloatingWidgets, Footer, TrustStrip } from "@/components/Footer";
import { MobileTabBar, Motion, RefCapture, SignupPopup } from "@/components/Growth";
import { AnnouncementBar, Header } from "@/components/Header";
import { getTaxonomy } from "@/lib/catalog";
import { getLang } from "@/lib/i18n-server";
import { liveNav, shopNav } from "@/lib/live-nav";
import { ShopNavProvider } from "@/lib/site-context";
import { getSettings } from "@/lib/site-store";
import { translateDeep } from "@/lib/translate";
import { ShopProvider } from "@/lib/store";
import { ScrollCue } from "@/components/ScrollCue";
import { headers } from "next/headers";

// Catalog lives in the database, so pages render on request and always show current data.
export const dynamic = "force-dynamic";

export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const nav = await liveNav();
  const tax = await getTaxonomy();
  // Only categories with something on sale (switching a source off hides its empty categories).
  const menus = await translateDeep(shopNav(await getSettings(), nav, tax), lang, ["label", "title", "text"]);
  const taxonomy = shopImgDeep(await translateDeep({ ...tax, categories: tax.categories.filter((c) => nav.categories.has(c.slug)), concerns: tax.concerns.filter((c) => nav.concerns.has(c.slug)) }, lang, ["name"]));
  const ai = (await getExtras()).advisor;
  const aiCfg = ai.enabled && (await anthropicKey()) ? await translateDeep({ name: ai.name, greeting: ai.greeting, suggestions: ai.suggestions }, lang, ["greeting", "suggestions"]) : null;
  // Inside the iPhone app (its web pages say "SuperYouApp"): no site header, footer, tab bar or pop-ups; the app has its own.
  const inApp = /SuperYouApp/.test((await headers()).get("user-agent") ?? "");
  if (inApp)
    return (
      <ShopNavProvider nav={menus}>
        <ShopProvider>
          <main className="min-h-[60vh] pb-10">{children}</main>
          <CartDrawer />
        </ShopProvider>
      </ShopNavProvider>
    );
  return (
    <ShopNavProvider nav={menus}>
    <ShopProvider>
      <AnnouncementBar />
      <Header taxonomy={taxonomy} />
      <main className="min-h-[60vh]">{children}</main>
      <TrustStrip />
      <Footer categories={taxonomy.categories} />
      <CartDrawer />
      <FloatingWidgets />
      {aiCfg && <Advisor cfg={aiCfg} />}
      <SignupPopup />
      <RefCapture />
      <Motion />
      <ScrollCue />
      <MobileTabBar />
    </ShopProvider>
    </ShopNavProvider>
  );
}
