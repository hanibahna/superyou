import { notFound } from "next/navigation";
import { getGrowth } from "@/lib/growth-store";
import { Advent } from "./Advent";

export const metadata = { title: "Beauty advent calendar" };

export default async function AdventPage() {
  const g = await getGrowth();
  if (!g.advent.enabled) notFound();
  // Today in Beirut decides which doors are open; future doors' contents never leave the server.
  const now = new Date(Date.now() + 2 * 3600e3);
  const today = now.getUTCFullYear() > g.advent.year || (now.getUTCFullYear() === g.advent.year && now.getUTCMonth() === 11) ? (now.getUTCFullYear() > g.advent.year ? 99 : now.getUTCDate()) : 0;
  const doors = g.advent.doors.map((d) => (d.day <= today ? { ...d, open: true } : { day: d.day, title: "", text: "", code: "", href: "", image: "", open: false }));
  return <Advent title={g.advent.title} intro={g.advent.intro} doors={doors} today={today} year={g.advent.year} />;
}
