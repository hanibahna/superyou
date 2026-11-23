import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { ShadeFinder } from "./ShadeFinder";

export async function generateMetadata() {
  return { title: 'Foundation shade finder', description: 'Find your foundation shade online: compare shades across brands and get a match before you buy, with delivery across Lebanon.', ...(await (await import("@/lib/seo")).canonical('/shade-finder/')) };
}

export default async function ShadeFinderPage() {
  if (!(await getGrowth()).shadeFinder.enabled) notFound();
  return <ShadeFinder />;
}
