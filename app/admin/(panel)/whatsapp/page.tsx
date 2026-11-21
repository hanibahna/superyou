import { WhatsAppAdmin } from "@/components/admin/WhatsAppAdmin";
import { getAllProducts, getTaxonomy } from "@/lib/catalog";
import { getServices } from "@/lib/site-store";
import { getCampaigns, getSegments, getWaConfig, provider, recentLog } from "@/lib/whatsapp";

export default async function WhatsAppPage() {
  const [config, segments, campaigns, log, tax, all, services] = await Promise.all([getWaConfig(), getSegments(), getCampaigns(), recentLog(300), getTaxonomy(), getAllProducts(), getServices()]);
  const p = provider();
  const env = {
    provider: p,
    meta: !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    metaWaba: !!process.env.WHATSAPP_WABA_ID,
    d360: !!process.env.D360_API_KEY,
    wati: !!(process.env.WATI_API_URL && process.env.WATI_API_TOKEN),
    verifyToken: !!process.env.WHATSAPP_VERIFY_TOKEN,
    appSecret: !!process.env.WHATSAPP_APP_SECRET,
    webhookKey: process.env.WHATSAPP_WEBHOOK_KEY ?? "",
    cron: !!process.env.CRON_SECRET,
  };
  return (
    <WhatsAppAdmin
      initialConfig={config}
      env={env}
      initialSegments={segments}
      initialCampaigns={campaigns}
      log={log}
      brands={Array.from(new Set(all.map((x) => x.brand))).sort((a, b) => a.localeCompare(b))}
      categories={tax.categories.map((c) => ({ value: c.slug, label: c.name }))}
      services={[...services.services.map((s) => s.title), ...services.events.map((e) => e.title)]}
    />
  );
}
