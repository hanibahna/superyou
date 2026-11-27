import { requireAdmin } from "@/lib/admin-auth";
import { has2fa } from "@/lib/admin-security";
import { SecuritySetup } from "@/components/admin/SecuritySetup";
import { db } from "@/lib/db-core";

export default async function SecurityPage() {
  const me = await requireAdmin();
  const enabled = await has2fa(me.id);
  const raw = me.role === "owner" ? await db.cmd<string[] | null>(["HGETALL", "csp:reports"]).catch(() => null) : null;
  const csp: [string, number][] = [];
  for (let i = 0; raw && i < raw.length; i += 2) csp.push([raw[i], Number(raw[i + 1])]);
  csp.sort((a, b) => b[1] - a[1]);
  return (
    <div className="max-w-xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">My sign-in security</h1>
        <p className="text-sm text-muted">Add a second step to your admin sign-in: after your password, a 6-digit code from an authenticator app on your phone (Google Authenticator, Microsoft Authenticator or 1Password). Someone who learns your password still can't get in. Every admin sign-in is also emailed to the owner.</p>
      </div>
      <SecuritySetup enabled={enabled} />
      {me.role === "owner" && (
        <div className="rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">Script protection (testing)</h2>
          <p className="text-sm text-muted">The site tells browsers which outside scripts and services are allowed. For now it only reports what it would block, so nothing breaks. Once this list only shows things we don't use, it can be switched to blocking.</p>
          {csp.length ? (
            <table className="mt-3 w-full text-sm">
              <tbody>{csp.slice(0, 20).map(([k, n]) => <tr key={k} className="border-t border-line"><td className="py-1 pr-2 font-mono text-xs">{k}</td><td className="py-1 text-right">{n}</td></tr>)}</tbody>
            </table>
          ) : <p className="mt-3 text-sm">No reports yet.</p>}
        </div>
      )}
    </div>
  );
}
