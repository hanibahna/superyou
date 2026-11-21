export const metadata = { title: "Admin", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return <div className="admin-ui min-h-screen bg-[#f5f6f5] text-ink">{children}</div>;
}
