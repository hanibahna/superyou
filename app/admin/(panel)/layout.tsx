import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin-auth";
import { dbConfigured } from "@/lib/db";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div dir="ltr" className="lg:grid lg:min-h-screen lg:grid-cols-[230px_1fr]">
      <AdminNav />
      <div className="min-w-0">
        {!dbConfigured && (
          <div className="bg-amber-100 px-6 py-2.5 text-sm text-amber-900">
            <b>No database connected</b> — changes are temporary. In Vercel go to Storage → Create Database → Upstash (Redis), connect it to this project and redeploy.
          </div>
        )}
        <div className="mx-auto max-w-6xl p-5 md:p-8">{children}</div>
      </div>
    </div>
  );
}
