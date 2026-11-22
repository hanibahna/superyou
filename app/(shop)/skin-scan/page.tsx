import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { SkinScan } from "./SkinScan";
import { anthropicKey } from "@/lib/extras";

export const metadata = { title: "SuperScan: 3D AI skin scan", description: "SuperScan, the free 3D AI skin scan by SuperYou: turn your head in a circle and get your skin type, a zone-by-zone reading and a routine from products in stock." };

const INTRO = "SuperScan is our free 3D AI skin scan, like setting up Face ID: look at the screen, slowly turn your head in a circle, and the AI reads your skin from the front and both sides. You get your skin type, a zone-by-zone reading and a routine from products in stock. Photos are analysed once and never stored.";

export default async function SkinScanPage() {
  const g = await getGrowth();
  if (!g.skinScan.enabled) notFound();
  return <SkinScan intro={/selfie|upload/i.test(g.skinScan.intro) ? INTRO : g.skinScan.intro} ready={!!(await anthropicKey())} />;
}
