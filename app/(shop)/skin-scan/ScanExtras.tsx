"use client";

import { useState } from "react";
import { useT } from "@/lib/site-context";
import type { CardItem } from "@/lib/listing";

type Analysis = { skinType?: string; concerns: string[]; sensitive: boolean; observations: string[]; advice: string; zones?: { zone: string; note: string }[]; confidence?: string; redFlags?: string[] };
type Step = { id: string; name: string; time: string; tip: string; picks: CardItem[] };

const slim = (steps: Step[]) => steps.map((s) => ({ name: s.name, time: s.time, tip: s.tip, product: s.picks[0] ? { slug: s.picks[0].slug, name: s.picks[0].name, brand: s.picks[0].brand, price: s.picks[0].price } : null }));

/** "Send me my routine" on WhatsApp / email; saves the scan (never the photo) to their account. */
export function SendRoutine({ analysis, steps }: { analysis: Analysis; steps: Step[] }) {
  const t = useT();
  const [f, setF] = useState({ name: "", phone: "", email: "" });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ link: string; whatsapp: boolean; email: boolean } | null>(null);
  const [err, setErr] = useState("");
  const send = async () => {
    setBusy(true); setErr("");
    const r = await fetch("/api/skin-scan/save/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, consent: true, analysis, steps: slim(steps) }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) return setErr(d.error ?? t("Please try again"));
    setDone(d);
  };
  const box = "min-h-[48px] w-full rounded-xl border border-line px-3 text-base outline-none focus:border-ink md:text-sm";
  if (done)
    return (
      <div className="mt-6 rounded-2xl bg-green-50 p-5 text-sm">
        <p className="font-semibold">{t("Saved ✓")} {done.whatsapp ? t("Sent to your WhatsApp.") : ""} {done.email ? t("Sent to your email.") : ""}</p>
        <p className="mt-1">{t("Your routine is saved, and we'll remind you in 6 weeks to rescan and see your progress.")} <a href={done.link} className="font-semibold underline">{t("Open my saved scan")}</a></p>
      </div>
    );
  return (
    <div className="mt-6 rounded-2xl border border-line p-5">
      <p className="font-semibold">{t("Get your routine on WhatsApp or email")}</p>
      <p className="mt-1 text-sm text-muted">{t("We'll save it (not your photo) so you can shop it later, and remind you to rescan in 6 weeks.")}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <input aria-label={t("Your name")} placeholder={t("Your name")} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} className={box} />
        <input aria-label={t("WhatsApp number")} inputMode="tel" placeholder={t("WhatsApp number")} value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} className={box} />
        <input aria-label={t("Email (optional)")} type="email" placeholder={t("Email (optional)")} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={box} />
      </div>
      {err && <p className="mt-2 text-sm text-sale">{err}</p>}
      <button onClick={send} disabled={busy || (!f.phone && !f.email)} className="mt-3 min-h-[48px] w-full rounded-full bg-ink font-semibold text-white disabled:opacity-40 sm:w-auto sm:px-6">{busy ? t("Sending…") : t("Send me my routine")}</button>
      <p className="mt-2 text-[11px] text-muted">{t("By sending, you agree to get your results and a rescan reminder from SuperYou. Reply STOP any time.")}</p>
    </div>
  );
}

/** Share the result as a picture (Instagram story, Facebook, WhatsApp…) with "made with SuperYou" and a link to try it. */
export function ShareScan({ analysis, steps }: { analysis: Analysis; steps: Step[] }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const url = "https://www.shopsuperyou.com/skin-scan/?utm_source=scan_share";
  const draw = async (): Promise<Blob> => {
    await document.fonts?.ready;
    const W = 1080, H = 1920, c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    const bg = g.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, "#8a3656"); bg.addColorStop(0.55, "#c0587a"); bg.addColorStop(1, "#6d4bb8");
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    const font = getComputedStyle(document.body).fontFamily || "sans-serif";
    const text = (s: string, x: number, y: number, size: number, weight = 600, color = "#fff", align: CanvasTextAlign = "left") => { g.font = `${weight} ${size}px ${font}`; g.fillStyle = color; g.textAlign = align; g.fillText(s, x, y); };
    const wrap = (s: string, x: number, y: number, size: number, maxW: number, weight = 500, color = "#fff") => { g.font = `${weight} ${size}px ${font}`; let line = "", yy = y; for (const w of s.split(" ")) { const tst = line ? `${line} ${w}` : w; if (g.measureText(tst).width > maxW) { text(line, x, yy, size, weight, color); line = w; yy += size * 1.3; } else line = tst; } if (line) text(line, x, yy, size, weight, color); return yy + size * 1.3; };
    text("SUPERYOU", 90, 170, 64, 800);
    text("AI SKIN SCAN", 90, 230, 30, 700, "rgba(255,255,255,.8)");
    // card
    g.fillStyle = "rgba(255,255,255,.96)"; g.beginPath(); g.roundRect(70, 320, W - 140, 1180, 48); g.fill();
    text(t("My skin today"), 130, 420, 34, 600, "#6b5a62");
    let y = wrap(`${analysis.skinType ?? ""} ${t("skin")}${analysis.sensitive ? `, ${t("easily irritated")}` : ""}`, 130, 510, 76, W - 260, 800, "#2e2229");
    if (analysis.concerns.length) y = wrap(`${t("Focus")}: ${analysis.concerns.join(" · ")}`, 130, y + 10, 40, W - 260, 600, "#8a3656");
    y += 40;
    text(t("My routine"), 130, y, 34, 600, "#6b5a62"); y += 70;
    for (const [i, s] of steps.slice(0, 6).entries()) {
      text(`${i + 1}. ${s.name}`, 130, y, 42, 700, "#2e2229");
      if (s.picks[0]) { y = wrap(`${s.picks[0].brand} ${s.picks[0].name}`, 175, y + 52, 32, W - 320, 500, "#6b5a62"); } else y += 60;
      y += 18;
      if (y > 1420) break;
    }
    text(t("Made with the SuperYou AI skin scan"), W / 2, 1640, 40, 700, "#fff", "center");
    text(t("Try yours free at"), W / 2, 1710, 36, 500, "rgba(255,255,255,.85)", "center");
    text("shopsuperyou.com/skin-scan", W / 2, 1780, 52, 800, "#fff", "center");
    return await new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
  };
  const share = async () => {
    setBusy(true);
    try {
      const blob = await draw();
      const file = new File([blob], "my-superyou-skin-scan.png", { type: "image/png" });
      const msg = `${t("I just did the free AI skin scan on SuperYou. Try yours:")} ${url}`;
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: "My SuperYou skin scan", text: msg }).catch(() => {});
      } else {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    } finally { setBusy(false); }
  };
  const fb = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  return (
    <div className="mt-6 rounded-2xl bg-[#f6f1f3] p-5">
      <p className="font-semibold">{t("Share your result")}</p>
      <p className="mt-1 text-sm text-muted">{t("A picture of your skin type and routine (never your photo), ready for your Instagram story, Facebook or WhatsApp.")}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={share} disabled={busy} className="scan-glow inline-flex min-h-[44px] items-center rounded-full px-5 text-sm font-semibold text-white">{busy ? t("Making your picture…") : t("Share to Instagram / Facebook")}</button>
        <a href={fb} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-white px-5 text-sm font-semibold">Facebook</a>
        <a href={`https://wa.me/?text=${encodeURIComponent(`${t("Try the free AI skin scan on SuperYou:")} ${url}`)}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-full border border-line bg-white px-5 text-sm font-semibold">WhatsApp</a>
      </div>
      <p className="mt-2 text-[11px] text-muted">{t("On a computer the picture downloads: post it from your phone or Instagram.")}</p>
    </div>
  );
}

/** When rescanning from the 6-week reminder: the previous reading, to compare. */
export function PreviousScan({ prev }: { prev: { createdAt: string; analysis: Analysis } }) {
  const t = useT();
  const a = prev.analysis;
  return (
    <div className="mt-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50/50 p-4 text-sm">
      <p className="font-semibold">{t("Your last scan")} · {new Date(prev.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</p>
      <p className="mt-1">{a.skinType} {t("skin")}{a.concerns.length ? ` · ${t("Focus")}: ${a.concerns.join(" · ")}` : ""}</p>
      <ul className="mt-1 list-disc ps-5 text-muted">{a.observations.slice(0, 3).map((o) => <li key={o}>{o}</li>)}</ul>
    </div>
  );
}
