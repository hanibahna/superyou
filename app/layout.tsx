import type { Metadata, Viewport } from "next";
import { liveNav, shopNav } from "@/lib/live-nav";
import "./globals.css";
import { getIndex, getTaxonomy } from "@/lib/catalog";
import { publicGrowth } from "@/lib/growth";
import { getGrowth } from "@/lib/growth-store";
import { dirOf, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { translateDeep } from "@/lib/translate";
import { layoutAttrs, layoutCss, layoutFontsHref } from "@/lib/layouts";
import { SiteProvider } from "@/lib/site-context";
import { getLayout, getMarketing, getRoutine, getSearchSettings, getSettings } from "@/lib/site-store";
import { publicTracking } from "@/lib/marketing";
import { Tracking } from "@/components/Tracking";
import { AppBridge } from "@/components/AppBridge";
import { buildPalette, paletteCss } from "@/lib/theme";
import { getTheme } from "@/lib/theme-store";

// Edge to edge on every iPhone and iPad (no white bars beside the notch in landscape);
// the layout pads itself with the safe areas instead.
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#ffffff" };

export async function generateMetadata(): Promise<Metadata> {
  await getIndex();
  const s = await getSettings();
  return {
    title: { default: s.seo.title || `${s.store.name} – Original beauty & parapharmacy in Lebanon`, template: `%s – ${s.store.name}` },
    description: s.seo.description || `${s.store.tagline}. Every product original, every question answered by a pharmacist, every order at your door, paid when it arrives.`,
    // Shared links (WhatsApp, Instagram, Facebook) show the SuperYou card unless a page sets its own picture.
    openGraph: { type: "website", siteName: s.store.name, locale: "en_LB" },
    twitter: { card: "summary_large_image" },
  };
}

// Colours, layout and settings come from the database (Admin), so render on request.
export const dynamic = "force-dynamic";

// Page bodies stay on the server; the browser only needs the titles of footer pages.
function publicSettings(s: Awaited<ReturnType<typeof getSettings>>, nav: Awaited<ReturnType<typeof liveNav>>, tax: Awaited<ReturnType<typeof getTaxonomy>>, wholesale: boolean) {
  const pages = Object.fromEntries(Object.entries(s.pages).filter(([, p]) => p.footer !== false).map(([k, p]) => [k, { title: p.title, body: "" }]));
  // Menus only show categories that have products on sale (see lib/live-nav.ts).
  return { ...s, pages, ...shopNav(s, nav, tax, wholesale) };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await getIndex(); // first run: loads the built-in catalog and store setup before anything is read
  const [theme, layout, settings, search, routine, growth, marketing] = await Promise.all([getTheme(), getLayout(), getSettings(), getSearchSettings(), getRoutine(), getGrowth(), getMarketing()]);
  const lang: Lang = await getLang();
  const frame = `:root{--frame-bg:${growth.images.frame === "grey" ? "#f5f5f5" : "#ffffff"};--frame-pad:${growth.images.padding}%}`;
  const palette = buildPalette(theme);
  return (
    <html lang={lang} dir={dirOf(lang)} data-motion={growth.motion === false ? "off" : "on"} {...layoutAttrs(layout)}>
      <head>
        <style id="shop-theme" dangerouslySetInnerHTML={{ __html: paletteCss(palette) + layoutCss(layout) + frame }} />
        {layoutFontsHref(layout) && <><link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" /><link rel="stylesheet" href={layoutFontsHref(layout)!} /></>}
        {lang === "ar" && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;800&display=swap" />}
        <meta name="theme-color" content={palette["brand-600"]} />
        {marketing.tracking.gsc && <meta name="google-site-verification" content={marketing.tracking.gsc} />}
        {marketing.tracking.metaDomain && <meta name="facebook-domain-verification" content={marketing.tracking.metaDomain} />}
      </head>
      <body>
        <SiteProvider value={{ settings: await translateDeep(publicSettings(settings, await liveNav(), await getTaxonomy(), growth.bulk.wholesale), lang, ["label", "title", "text", "tagline", "estimate", "description"]), search: { predictive: search.predictive, popular: search.popular }, routineEnabled: routine.enabled, growth: await translateDeep(await withShopsRead(publicGrowth(growth, !!(await (await import("@/lib/extras")).anthropicKey()))), lang, ["title", "text", "tabLabel", "cartExitText", "label", "hours", "perks", "lines", "returnsSummary"]), lang }}>
          {children}
        </SiteProvider>
        <Tracking t={publicTracking(marketing)} />
        <AppBridge />
      </body>
    </html>
  );
}

/** Only shops the last price check could actually read are named as "checked". */
async function withShopsRead<T extends { superPriceShops: string[] }>(pg: T): Promise<T & { videoCalls: boolean; eventsOn: boolean }> {
  const ok = await (await import("@/lib/price-match")).shopsRead().catch(() => null);
  const svc = await (await import("@/lib/site-store")).getServices();
  const on = { videoCalls: svc.enabled && svc.videoCalls !== false, eventsOn: svc.enabled && svc.eventsOn !== false };
  return ok ? { ...pg, ...on, superPriceShops: pg.superPriceShops.filter((s) => ok.includes(s)) } : { ...pg, ...on };
}
