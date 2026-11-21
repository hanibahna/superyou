import type { Metadata } from "next";
import { liveNav, pruneLinks, pruneMenu } from "@/lib/live-nav";
import "./globals.css";
import { getIndex } from "@/lib/catalog";
import { publicGrowth } from "@/lib/growth";
import { getGrowth } from "@/lib/growth-store";
import { dirOf, type Lang } from "@/lib/i18n";
import { getLang } from "@/lib/i18n-server";
import { translateDeep } from "@/lib/translate";
import { layoutAttrs, layoutCss } from "@/lib/layouts";
import { SiteProvider } from "@/lib/site-context";
import { getLayout, getRoutine, getSearchSettings, getSettings } from "@/lib/site-store";
import { buildPalette, paletteCss } from "@/lib/theme";
import { getTheme } from "@/lib/theme-store";

export async function generateMetadata(): Promise<Metadata> {
  await getIndex();
  const s = await getSettings();
  return {
    title: { default: s.seo.title || `${s.store.name} – ${s.store.tagline}`, template: `%s – ${s.store.name}` },
    description: s.seo.description || s.store.tagline,
  };
}

// Colours, layout and settings come from the database (Admin), so render on request.
export const dynamic = "force-dynamic";

// Page bodies stay on the server; the browser only needs the titles of footer pages.
function publicSettings(s: Awaited<ReturnType<typeof getSettings>>, nav: Awaited<ReturnType<typeof liveNav>>) {
  const pages = Object.fromEntries(Object.entries(s.pages).filter(([, p]) => p.footer !== false).map(([k, p]) => [k, { title: p.title, body: "" }]));
  // Menus only show categories that have products on sale (see lib/live-nav.ts).
  const footerMenu = s.footerMenu.map((c) => ({ ...c, links: pruneLinks(c.links, nav) })).filter((c) => c.links.length);
  return { ...s, pages, menu: pruneMenu(s.menu, nav), footerMenu };
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await getIndex(); // first run: loads the built-in catalog and store setup before anything is read
  const [theme, layout, settings, search, routine, growth] = await Promise.all([getTheme(), getLayout(), getSettings(), getSearchSettings(), getRoutine(), getGrowth()]);
  const lang: Lang = await getLang();
  const frame = `:root{--frame-bg:${growth.images.frame === "grey" ? "#f5f5f5" : "#ffffff"};--frame-pad:${growth.images.padding}%}`;
  const palette = buildPalette(theme);
  return (
    <html lang={lang} dir={dirOf(lang)} data-motion={growth.motion === false ? "off" : "on"} {...layoutAttrs(layout)}>
      <head>
        <style id="shop-theme" dangerouslySetInnerHTML={{ __html: paletteCss(palette) + layoutCss(layout) + frame }} />
        {lang === "ar" && <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Kufi+Arabic:wght@400;600;800&display=swap" />}
        <meta name="theme-color" content={palette["brand-600"]} />
      </head>
      <body>
        <SiteProvider value={{ settings: await translateDeep(publicSettings(settings, await liveNav()), lang, ["label", "title", "text", "tagline", "estimate", "description"]), search: { predictive: search.predictive, popular: search.popular }, routineEnabled: routine.enabled, growth: await translateDeep(publicGrowth(growth), lang, ["title", "text", "tabLabel", "cartExitText", "label", "hours", "perks", "lines", "returnsSummary"]), lang }}>
          {children}
        </SiteProvider>
      </body>
    </html>
  );
}
