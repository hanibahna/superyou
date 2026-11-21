"use client";

// Public site settings available to every client component (no secrets in here).

import { createContext, useContext } from "react";
import { defaultGrowth, publicGrowth, type PublicGrowth } from "@/lib/growth";
import { tr, type Lang } from "@/lib/i18n";
import { defaultSettings, defaultSearchSettings, type Settings } from "@/lib/site";

export type PublicSite = {
  settings: Settings;
  search: { predictive: boolean; popular: string[] };
  routineEnabled: boolean;
  growth: PublicGrowth;
  lang: Lang;
};

const Ctx = createContext<PublicSite>({ settings: defaultSettings, search: { predictive: defaultSearchSettings.predictive, popular: defaultSearchSettings.popular }, routineEnabled: true, growth: publicGrowth(defaultGrowth), lang: "en" });

export function SiteProvider({ value, children }: { value: PublicSite; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useSite = () => useContext(Ctx);
export const useSettings = () => useContext(Ctx).settings;
export const useGrowth = () => useContext(Ctx).growth;
/** Translate UI text for the visitor's language: const t = useT(); t("Add to cart") */
export function useT() {
  const lang = useContext(Ctx).lang;
  return (s: string) => tr(lang, s);
}
export const useLang = () => useContext(Ctx).lang;
