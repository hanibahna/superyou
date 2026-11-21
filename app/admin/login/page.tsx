import { redirect } from "next/navigation";
import { adminPassword, isAdmin } from "@/lib/admin-auth";
import { store } from "@/lib/config";
import { LoginForm } from "@/components/admin/LoginForm";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin/");
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/superyou-logo.svg" alt={store.name} className="h-6 w-auto" />
        <h1 className="mt-4 text-xl font-semibold">Admin sign in</h1>
        {adminPassword() ? (
          <LoginForm />
        ) : (
          <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Add an <b>ADMIN_PASSWORD</b> environment variable in Vercel (Settings → Environment Variables), then redeploy.
          </p>
        )}
      </div>
    </div>
  );
}
