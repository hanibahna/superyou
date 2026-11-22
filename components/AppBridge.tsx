"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Runs only inside the SuperYou iOS / Android app (Capacitor): asks for notification permission,
// sends the phone's push token to the shop, opens the page a tapped notification points to,
// and styles the status bar. On the website it does nothing.
type Cap = { isNativePlatform?: () => boolean; getPlatform?: () => string; Plugins?: Record<string, { [k: string]: (...a: unknown[]) => unknown }> };

export function AppBridge() {
  const router = useRouter();
  useEffect(() => {
    const cap = (window as unknown as { Capacitor?: Cap }).Capacitor;
    if (!cap?.isNativePlatform?.()) return;
    document.documentElement.classList.add("in-app");
    const platform = cap.getPlatform?.() ?? "";
    const P = cap.Plugins ?? {};
    try {
      P.StatusBar?.setStyle?.({ style: "DARK" });
    } catch {}
    // Firebase Messaging gives an FCM token on both iPhone and Android.
    const fm = P.FirebaseMessaging;
    if (!fm) return;
    (async () => {
      try {
        fm.addListener("notificationActionPerformed", (a: { notification?: { data?: { url?: string } } }) => {
          const url = a.notification?.data?.url;
          if (url && url.startsWith("/")) router.push(url);
        });
        const perm = (await fm.checkPermissions()) as { receive?: string };
        const ok = perm.receive === "granted" || ((await fm.requestPermissions()) as { receive?: string }).receive === "granted";
        if (!ok) return;
        const { token } = (await fm.getToken()) as { token?: string };
        if (token) await fetch("/api/app/push-token/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, platform }) });
      } catch {
        // notifications are optional
      }
    })();
  }, [router]);
  return null;
}
