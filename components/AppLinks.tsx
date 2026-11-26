"use client";

import { useGrowth, useT } from "@/lib/site-context";

/** "Get the app" buttons: shown only once the App Store / Google Play links are set (Admin › Growth › Apps). */
export function AppLinks({ dark = false, className = "" }: { dark?: boolean; className?: string }) {
  const t = useT();
  const apps = useGrowth().apps;
  if (!apps || (!apps.ios && !apps.android)) return null;
  const btn = `inline-flex min-h-[44px] items-center gap-2 rounded-xl px-3.5 py-2 text-start leading-tight ${dark ? "border border-white/30 text-white hover:bg-white/10" : "bg-ink text-white hover:opacity-90"}`;
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {apps.ios && (
          <a href={apps.ios} target="_blank" rel="noreferrer" className={btn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M16.5 12.6c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.8-3.2-.8-1.6 0-3.1 1-4 2.4-1.7 3-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.2.8c1.3 0 2.1-1.2 2.9-2.4.9-1.3 1.3-2.6 1.3-2.7-.1 0-2.4-.9-2.4-4zM14.2 5.6c.7-.8 1.1-1.9 1-3-1 0-2.1.7-2.8 1.5-.6.7-1.2 1.8-1 2.9 1.1.1 2.1-.6 2.8-1.4z" /></svg>
            <span><span className="block text-[10px] opacity-80">{t("Download on the")}</span><span className="block text-sm font-semibold">App Store</span></span>
          </a>
        )}
        {apps.android && (
          <a href={apps.android} target="_blank" rel="noreferrer" className={btn}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M4 2.5v19l10.2-9.5L4 2.5zm11.6 10.8L5.9 22.2l12-6.9-2.3-2zm4.6-2.6l-2.8-1.6-2.6 2.4 2.6 2.4 2.8-1.6c.8-.5.8-1.2 0-1.6zM5.9 1.8l9.7 8.9 2.3-2.1-12-6.8z" /></svg>
            <span><span className="block text-[10px] opacity-80">{t("Get it on")}</span><span className="block text-sm font-semibold">Google Play</span></span>
          </a>
        )}
      </div>
      {apps.note && <p className={`mt-2 text-xs ${dark ? "text-white/80" : "text-muted"}`}>{apps.note}</p>}
    </div>
  );
}
