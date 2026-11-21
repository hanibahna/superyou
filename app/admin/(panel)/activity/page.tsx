import { requireAdmin } from "@/lib/admin-auth";
import { auditLog } from "@/lib/staff";

const NAMES: [RegExp, string][] = [
  [/^POST orders\/bulk$/, "Updated several orders"], [/^PATCH orders\/(.+)$/, "Updated order $1"], [/^POST orders\/(.+)\/refund$/, "Refunded order $1"],
  [/^POST inventory$/, "Changed stock counts"], [/^POST giftcards$/, "Gift cards"], [/^POST staff$/, "Staff accounts"], [/^POST products.*$/, "Products"],
  [/^(POST|PUT|PATCH|DELETE) (\w[\w-]*).*$/, "$2"],
];
const pretty = (a: string) => {
  for (const [re, out] of NAMES) if (re.test(a)) return a.replace(re, out);
  return a;
};

export default async function ActivityPage() {
  await requireAdmin("sales");
  const log = await auditLog(400);
  return (
    <div>
      <h1 className="text-2xl font-semibold">Activity log</h1>
      <p className="text-sm text-muted">Every sign-in and every change made in the admin, newest first (last 3,000 kept).</p>
      <div className="mt-5 overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <tbody className="divide-y divide-line">
            {log.map((e, i) => (
              <tr key={i}>
                <td className="whitespace-nowrap p-3 text-muted">{new Date(e.at).toLocaleString("en-GB", { dateStyle: "short", timeStyle: "medium", timeZone: "Asia/Beirut" })}</td>
                <td className="p-3 font-medium">{e.who}</td>
                <td className="p-3">{pretty(e.action)}{e.detail ? <span className="text-muted"> · {e.detail}</span> : null}</td>
              </tr>
            ))}
            {!log.length && <tr><td className="p-10 text-center text-muted">Nothing yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
