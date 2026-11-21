import "server-only";

import { ensureSeeded } from "@/lib/catalog";
import { db } from "@/lib/db";
import { defaultTheme, isHex, type ThemeInput } from "@/lib/theme";

export async function getTheme(): Promise<ThemeInput> {
  try {
    await ensureSeeded();
    const raw = await db.cmd<string | null>(["GET", "theme"]);
    if (!raw) return defaultTheme;
    const t = JSON.parse(raw) as ThemeInput;
    return (Object.keys(defaultTheme) as (keyof ThemeInput)[]).every((k) => isHex(t[k] ?? "")) ? t : defaultTheme;
  } catch {
    return defaultTheme; // never let a database hiccup break the shop's styling
  }
}

export async function saveTheme(t: ThemeInput) {
  await db.cmd(["SET", "theme", JSON.stringify(t)]);
}
