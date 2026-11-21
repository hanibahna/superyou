import { ClubAdjust } from "@/components/admin/ClubAdjust";
import { tierFor } from "@/lib/growth";
import { allMembers, getGrowth, listVouchers, yearSpend } from "@/lib/growth-store";

export default async function ClubAdminPage() {
  const [g, members, vouchers] = await Promise.all([getGrowth(), allMembers(), listVouchers(300)]);
  const rows = members.map((m) => ({ m, spend: yearSpend(m) })).sort((a, b) => b.spend - a.spend);
  const kinds = ["welcome", "cart", "club", "birthday"] as const;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{g.club.name} & codes</h1>
        <p className="text-sm text-muted">Members, their points and tier, and every personal code given out (welcome pop-up, club rewards, birthdays). Settings: Growth & loyalty.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Stat label="Members" value={members.length} />
        {kinds.map((k) => {
          const all = vouchers.filter((v) => v.kind === k);
          return <Stat key={k} label={`${k} codes · used`} value={`${all.length} · ${all.filter((v) => v.used).length}`} />;
        })}
      </div>
      <ClubAdjust />
      <section className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="p-3">Member</th><th>Phone</th><th>Tier</th><th>Spend (12 m)</th><th>Points</th><th>Vouchers</th><th>Birthday</th><th>Referral code</th><th>Joined</th></tr></thead>
          <tbody>
            {rows.slice(0, 500).map(({ m, spend }) => (
              <tr key={m.phone} className="border-t border-line">
                <td className="p-3 font-medium">{m.name}</td><td>{m.phone}</td><td>{tierFor(g.club.tiers, spend).tier.name}</td><td>${spend.toFixed(2)}</td><td>{m.points}</td><td>{m.rewards.length}</td><td>{m.birthday ?? ""}</td><td className="font-mono text-xs">{m.ref ?? ""}</td><td>{m.joinedAt.slice(0, 10)}</td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={9} className="p-6 text-muted">No members yet. Customers join at checkout or on /club/.</td></tr>}
          </tbody>
        </table>
      </section>
      <section className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <h2 className="p-3 font-semibold">Latest personal codes</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted"><tr><th className="p-3">Code</th><th>Type</th><th>Value</th><th>For</th><th>Expires</th><th>Used</th></tr></thead>
          <tbody>
            {vouchers.slice(0, 200).map((v) => (
              <tr key={v.code} className="border-t border-line">
                <td className="p-3 font-mono">{v.code}</td><td className="capitalize">{v.kind}</td><td>{v.percent ? `${v.percent}%` : `$${v.amount}`}</td><td>{v.owner}</td><td>{v.expires.slice(0, 10)}</td><td>{v.used ? "✓" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl bg-white p-4 shadow-sm"><p className="text-xs capitalize text-muted">{label}</p><p className="text-2xl font-semibold">{value}</p></div>;
}
