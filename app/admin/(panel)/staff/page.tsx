import Link from "next/link";
import { StaffAdmin } from "@/components/admin/StaffAdmin";
import { requireAdmin } from "@/lib/admin-auth";
import { roleInfo } from "@/lib/roles";
import { listStaff } from "@/lib/staff";

export default async function StaffPage() {
  await requireAdmin("staff");
  const staff = await listStaff();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-muted">Give each person their own login instead of sharing the owner password. They sign in at /admin with their email. Everything they change is recorded in the <Link href="/admin/activity/" className="underline">activity log</Link>.</p>
        </div>
      </div>
      <StaffAdmin staff={staff} roles={Object.entries(roleInfo).filter(([r]) => r !== "owner").map(([value, r]) => ({ value, label: r.label, about: r.about }))} />
    </div>
  );
}
