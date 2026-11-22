import type { CapacitorConfig } from "@capacitor/cli";

// The apps open the live shop (so every change on the site shows in the apps at once) and add
// native features on top: push notifications, share sheet, splash screen, status bar and an
// offline page bundled in the app (www/index.html) for when there is no connection.
const config: CapacitorConfig = {
  appId: "com.shopsuperyou.app",
  appName: "SuperYou",
  webDir: "www",
  server: {
    url: "https://www.shopsuperyou.com/?app=1",
    allowNavigation: ["shopsuperyou.com", "*.shopsuperyou.com", "wa.me", "api.whatsapp.com"],
    errorPath: "index.html",
  },
  backgroundColor: "#141214",
  plugins: {
    SplashScreen: { launchShowDuration: 1200, backgroundColor: "#141214", showSpinner: false, androidScaleType: "CENTER_CROP" },
    StatusBar: { style: "DARK", backgroundColor: "#141214", overlaysWebView: false },
    FirebaseMessaging: { presentationOptions: ["badge", "sound", "alert"] },
  },
  ios: { contentInset: "always", limitsNavigationsToAppBoundDomains: true },
  android: { allowMixedContent: false },
};

export default config;
