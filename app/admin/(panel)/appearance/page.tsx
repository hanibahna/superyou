import { LayoutEditor } from "@/components/admin/LayoutEditor";
import { ThemeEditor } from "@/components/admin/ThemeEditor";
import { getLayout } from "@/lib/site-store";
import { getTheme } from "@/lib/theme-store";

export default async function AppearancePage() {
  const [theme, layout] = await Promise.all([getTheme(), getLayout()]);
  return (
    <div className="space-y-12">
      <LayoutEditor initial={layout} />
      <ThemeEditor initial={theme} />
    </div>
  );
}
