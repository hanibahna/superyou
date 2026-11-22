import "server-only";

import { createSign } from "node:crypto";
import { db } from "@/lib/db";

// Push notifications to the SuperYou iOS and Android apps through Firebase Cloud Messaging (FCM v1).
// One Firebase project serves both: Android directly, iOS through the APNs key uploaded to Firebase.
// The service-account key stays on the server.

export type AppSettings = { serviceAccount: string; log: { at: string; title: string; sent: number; failed: number }[] };
const KEY = "app:settings";
const TOKENS = "app:tokens";

export async function getAppSettings(): Promise<AppSettings> {
  try {
    const raw = await db.cmd<string | null>(["GET", KEY]);
    const v = raw ? (JSON.parse(raw) as Partial<AppSettings>) : {};
    return { serviceAccount: v.serviceAccount ?? "", log: v.log ?? [] };
  } catch {
    return { serviceAccount: "", log: [] };
  }
}
export async function saveAppSettings(v: AppSettings) {
  await db.cmd(["SET", KEY, JSON.stringify(v)]);
}

export async function saveToken(token: string, platform: string) {
  await db.cmd(["HSET", TOKENS, token, JSON.stringify({ platform, at: new Date().toISOString() })]);
}
export async function tokenStats() {
  try {
    const all = (await db.cmd<string[]>(["HGETALL", TOKENS])) ?? [];
    const out = { ios: 0, android: 0, total: 0 };
    for (let i = 1; i < all.length; i += 2) {
      const p = (JSON.parse(all[i]) as { platform: string }).platform;
      out.total++;
      if (p === "ios") out.ios++;
      else if (p === "android") out.android++;
    }
    return out;
  } catch {
    return { ios: 0, android: 0, total: 0 };
  }
}

type SA = { project_id: string; client_email: string; private_key: string };
function parseSA(raw: string): SA | null {
  try {
    const j = JSON.parse(raw) as SA;
    return j.project_id && j.client_email && j.private_key ? j : null;
  } catch {
    return null;
  }
}

const b64u = (v: string | Buffer) => Buffer.from(v).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
async function accessToken(sa: SA): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const head = b64u(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64u(JSON.stringify({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/firebase.messaging", aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claims}`).sign(sa.private_key);
  const r = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claims}.${b64u(sig)}` }) });
  const j = (await r.json()) as { access_token?: string; error_description?: string };
  if (!j.access_token) throw new Error(j.error_description ?? "Firebase sign-in failed");
  return j.access_token;
}

/** Sends to every registered phone (or one token). Removes phones that uninstalled the app. */
export async function sendPush(msg: { title: string; body: string; url?: string }, onlyToken?: string): Promise<{ sent: number; failed: number; error?: string }> {
  const s = await getAppSettings();
  const sa = parseSA(s.serviceAccount);
  if (!sa) return { sent: 0, failed: 0, error: "Paste the Firebase service-account key first" };
  const token = await accessToken(sa);
  const all = onlyToken ? [onlyToken, "{}"] : ((await db.cmd<string[]>(["HGETALL", TOKENS])) ?? []);
  let sent = 0, failed = 0;
  for (let i = 0; i < all.length; i += 2) {
    const t = all[i];
    const r = await fetch(`https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ message: { token: t, notification: { title: msg.title, body: msg.body }, data: { url: msg.url ?? "/" }, apns: { payload: { aps: { sound: "default" } } }, android: { priority: "high" } } }),
    }).catch(() => null);
    if (r?.ok) sent++;
    else {
      failed++;
      const txt = r ? await r.text() : "";
      if (/UNREGISTERED|NOT_FOUND|INVALID_ARGUMENT/.test(txt) && !onlyToken) await db.cmd(["HDEL", TOKENS, t]).catch(() => {});
    }
  }
  if (!onlyToken) {
    s.log = [{ at: new Date().toISOString(), title: msg.title, sent, failed }, ...s.log].slice(0, 30);
    await saveAppSettings(s);
  }
  return { sent, failed };
}
