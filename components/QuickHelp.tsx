"use client";

import Link from "next/link";
import { useGrowth, useSettings, useT } from "@/lib/site-context";
import { ScanIcon } from "./ScanIcon";

const I = {
  video: <path d="M3 7a2 2 0 012-2h9a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2zM16 10l5-3v10l-5-3" />,
  wa: <path d="M4 20l1.3-3.9A8 8 0 1112 20a8 8 0 01-3.9-1z" />,
  ai: <path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8zM19 15l.8 2.2 2.2.8-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" />,
  routine: <path d="M9 5h10M9 12h10M9 19h10M4 5h.01M4 12h.01M4 19h.01" />,
  track: <path d="M3 7h11v9H3zM14 10h4l3 3v3h-7M7 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3zM17 19a1.5 1.5 0 100-3 1.5 1.5 0 000 3z" />,
};
const Icon = ({ d }: { d: React.ReactNode }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{d}</svg>;

/** One row of help buttons: video call, WhatsApp, AI advisor, routine finder, order tracking. */
export function QuickHelp({ className = "" }: { className?: string }) {
  const t = useT();
  const s = useSettings();
  const scanOn = !!useGrowth().skinScan?.enabled;
  const base = "inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition";
  const pill = `${base} border-line bg-white hover:border-ink`;
  return (
    <div className={`no-scrollbar flex gap-2 overflow-x-auto ${className}`}>
      {scanOn && <Link href="/skin-scan/" className={`${base} scan-glow border-transparent text-white`}><ScanIcon size={16} />{t("SuperScan")}<span className="rounded-full bg-white/25 px-1.5 text-[10px] font-bold">NEW</span></Link>}
      <Link href="/services/?book=video-consult" className={`${base} border-ink bg-ink text-white hover:bg-black`}><Icon d={I.video} />{t("Video call a pharmacist")}</Link>
      <a href={`https://wa.me/${s.store.whatsapp}`} target="_blank" rel="noreferrer" className={pill}><Icon d={I.wa} />WhatsApp</a>
      <button onClick={() => window.dispatchEvent(new Event("open-advisor"))} className={pill}><Icon d={I.ai} />{t("Ask AI")}</button>
      <Link href="/routine/" className={pill}><Icon d={I.routine} />{t("Routine finder")}</Link>
      <Link href="/account/" className={pill}><Icon d={I.track} />{t("Track my order")}</Link>
    </div>
  );
}
