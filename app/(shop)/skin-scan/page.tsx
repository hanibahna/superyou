import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { SkinScan } from "./SkinScan";
import { anthropicKey } from "@/lib/extras";

export const metadata = { title: "3D AI Skin Scan", description: "Free AI 3D face scan: turn your head in a circle and get your skin type, a zone-by-zone reading and a routine from products in stock." };

const INTRO = "A free 3D face scan, like setting up Face ID: look at the screen, slowly turn your head in a circle, and the AI reads your skin from the front and both sides. You get your skin type, a zone-by-zone reading and a routine from products in stock. Photos are analysed once and never stored.";

export default async function SkinScanPage() {
  const g = await getGrowth();
  if (!g.skinScan.enabled) notFound();
  return <SkinScan intro={/selfie|upload/i.test(g.skinScan.intro) ? INTRO : g.skinScan.intro} ready={!!(await anthropicKey())} />;
}
