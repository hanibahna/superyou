import { getLang } from "@/lib/i18n-server";
import { translateDeep, translateMany } from "@/lib/translate";
import { notFound } from "next/navigation";
import { getServices, getSettings } from "@/lib/site-store";
import { ServicesView } from "./ServicesView";

export const metadata = { title: "Services & Events" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const [cfg0, settings] = await Promise.all([getServices(), getSettings()]);
  const cfg = await translateDeep(cfg0, await getLang(), ["name", "description", "intro", "title", "text", "category", "location", "price_note", "note"]);
  if (!cfg.enabled) notFound();
  const today = new Date().toISOString().slice(0, 10);
  const events = cfg.events.filter((e) => e.enabled && e.date >= today).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <ServicesView
      tab={(await searchParams).tab === "events" ? "events" : "services"}
      intro={cfg.intro}
      location={cfg.location || settings.store.address}
      hours={cfg.hours}
      daysAhead={cfg.daysAhead}
      services={cfg.services.filter((s) => s.enabled)}
      events={events}
      whatsapp={settings.store.whatsapp}
    />
  );
}
