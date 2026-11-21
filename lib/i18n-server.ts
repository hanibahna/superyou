import "server-only";
import { cookies, headers } from "next/headers";
import { isLang, tr, type Lang } from "@/lib/i18n";

/** Visitor's language on the server: /fr/… or /ar/… address first, then the saved choice. */
export async function getLang(): Promise<Lang> {
  const h = (await headers()).get("x-lang");
  if (isLang(h)) return h;
  const c = (await cookies()).get("lang")?.value;
  return isLang(c) ? c : "en";
}

export async function getT() {
  const lang = await getLang();
  return (s: string) => tr(lang, s);
}
