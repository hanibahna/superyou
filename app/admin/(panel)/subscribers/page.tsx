import { db } from "@/lib/db";

export default async function SubscribersPage() {
  const list = ((await db.cmd<string[]>(["ZREVRANGE", "subscribers", 0, 199])) ?? []) as string[];
  const total = (await db.cmd<number>(["ZCARD", "subscribers"])) ?? 0;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Newsletter subscribers</h1>
          <p className="text-sm text-muted">{total.toLocaleString("en-US")} people signed up from the footer or a homepage newsletter section.</p>
        </div>
        <a href="/api/admin/subscribers/" className="rounded-lg bg-brand-500 px-5 py-2 text-sm font-semibold text-white">Download CSV</a>
      </div>
      <div className="rounded-xl bg-white p-5 shadow-sm">
        {list.length === 0 ? <p className="text-sm text-muted">No subscribers yet.</p> : (
          <ul className="grid gap-1 text-sm sm:grid-cols-2 lg:grid-cols-3">{list.map((e) => <li key={e}>{e}</li>)}</ul>
        )}
        {total > list.length && <p className="mt-3 text-xs text-muted">Showing the latest 200 — download the CSV for everyone.</p>}
      </div>
    </div>
  );
}
