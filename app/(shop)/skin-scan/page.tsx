import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { SkinScan } from "./SkinScan";

export const metadata = { title: "AI skin scan" };

export default async function SkinScanPage() {
  const g = await getGrowth();
  if (!g.skinScan.enabled) notFound();
  return <SkinScan intro={g.skinScan.intro} ready={!!process.env.ANTHROPIC_API_KEY} />;
}
