import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { ShadeFinder } from "./ShadeFinder";

export const metadata = { title: "Foundation shade finder" };

export default async function ShadeFinderPage() {
  if (!(await getGrowth()).shadeFinder.enabled) notFound();
  return <ShadeFinder />;
}
