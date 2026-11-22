import { notFound } from "next/navigation";
import { finderById, finders } from "@/lib/finders";
import { FinderView } from "./FinderView";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const f = finderById((await params).id);
  return f ? { title: f.title, description: f.intro } : {};
}

export default async function FinderPage({ params }: { params: Promise<{ id: string }> }) {
  const f = finderById((await params).id);
  if (!f) notFound();
  return <FinderView finder={f} others={finders.filter((x) => x.id !== f.id).map((x) => ({ id: x.id, title: x.title }))} />;
}
