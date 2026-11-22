"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import type { PublicTracking } from "@/lib/marketing";
import { captureAttribution } from "@/lib/track";

// Loads the ad platforms' tags set in Admin → Campaigns & ads, and remembers campaign clicks for the order.
export function Tracking({ t }: { t: PublicTracking }) {
  const path = usePathname();
  useEffect(() => captureAttribution(), [path]);
  // Single-page navigation: tell the platforms about each new page.
  useEffect(() => {
    const w = window as unknown as { fbq?: (...a: unknown[]) => void; ttq?: { page: () => void }; snaptr?: (...a: unknown[]) => void; gtag?: (...a: unknown[]) => void; __syFirst?: boolean };
    if (!w.__syFirst) return void (w.__syFirst = true); // the first page view is sent by each tag itself
    w.gtag?.("event", "page_view", { page_path: path });
    w.fbq?.("track", "PageView");
    w.ttq?.page();
    w.snaptr?.("track", "PAGE_VIEW");
  }, [path]);

  if (path?.startsWith("/admin")) return null;
  const gtagId = t.ga4 || t.googleAds;
  return (
    <>
      {gtagId && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`} strategy="afterInteractive" />
          <Script id="sy-gtag" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}window.gtag=gtag;gtag('js',new Date());${t.ga4 ? `gtag('config','${t.ga4}');` : ""}${t.googleAds ? `gtag('config','${t.googleAds}');window.__syAds={googleAds:'${t.googleAds}',label:'${t.googleAdsPurchaseLabel}'};` : ""}`}</Script>
        </>
      )}
      {t.metaPixel && (
        <Script id="sy-meta" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${t.metaPixel}');fbq('track','PageView');`}</Script>
      )}
      {t.tiktokPixel && (
        <Script id="sy-tiktok" strategy="afterInteractive">{`!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};var o=d.createElement("script");o.type="text/javascript",o.async=!0,o.src=r+"?sdkid="+e+"&lib="+t;var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};ttq.load('${t.tiktokPixel}');ttq.page();}(window,document,'ttq');`}</Script>
      )}
      {t.snapPixel && (
        <Script id="sy-snap" strategy="afterInteractive">{`(function(e,t,n){if(e.snaptr)return;var a=e.snaptr=function(){a.handleRequest?a.handleRequest.apply(a,arguments):a.queue.push(arguments)};a.queue=[];var s='script';var r=t.createElement(s);r.async=!0;r.src=n;var u=t.getElementsByTagName(s)[0];u.parentNode.insertBefore(r,u)})(window,document,'https://sc-static.net/scevent.min.js');snaptr('init','${t.snapPixel}',{});snaptr('track','PAGE_VIEW');`}</Script>
      )}
    </>
  );
}
