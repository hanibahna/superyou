import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db-core";
import { sign } from "@/lib/admin-session";
import { newTotpSecret, totpUri, verifyTotp } from "@/lib/totp";

// Admin sign-in security: a second step with an authenticator app, sign-in limits that hold
// across all servers, and an email to the owner whenever someone signs in to the admin.
// Alerts go to the same addresses as the catalog sync report (REPORT_TO in lib/neo-sync.ts).

// Authenticator secrets are stored encrypted (AES-256-GCM).
const key = () => createHash("sha256").update(process.env.ADMIN_2FA_KEY || sign("2fa-key")).digest();
function seal(plain: string) {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64url")).join(".");
}
function open(sealed: string): string | null {
  try {
    const [iv, tag, enc] = sealed.split(".").map((s) => Buffer.from(s, "base64url"));
    const d = createDecipheriv("aes-256-gcm", key(), iv);
    d.setAuthTag(tag);
    return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
  } catch { return null; }
}

const H = "admin:2fa"; // id ("owner" or staff email) → sealed secret

// Recovery for a lost phone: list the account ("owner" or a staff email) in ADMIN_2FA_RESET in
// Vercel, redeploy, sign in with the password only, set up the new phone, then remove the variable.
const resetFor = (id: string) => (process.env.ADMIN_2FA_RESET ?? "").split(",").map((s) => s.trim().toLowerCase()).includes(id.toLowerCase());

export async function has2fa(id: string): Promise<boolean> {
  if (resetFor(id)) return false;
  return !!(await db.cmd<string | null>(["HGET", H, id]));
}

/** Checks a code for someone with the second step on. Each code works once. */
export async function check2fa(id: string, code: string): Promise<boolean> {
  const sealed = await db.cmd<string | null>(["HGET", H, id]);
  const secret = sealed ? open(sealed) : null;
  if (!secret) return false;
  const step = verifyTotp(secret, code);
  if (step === null) return false;
  const fresh = await db.cmd<string | null>(["SET", `admin:2fa:used:${id}:${step}`, "1", "NX", "EX", 120]);
  return fresh === "OK";
}

/** Starts setup: a new secret, kept for 15 minutes until confirmed with a first code. */
export async function start2fa(id: string, label: string) {
  const secret = newTotpSecret();
  await db.cmd(["SET", `admin:2fa:pending:${id}`, seal(secret), "EX", 900]);
  const uri = totpUri(secret, label);
  const QR = await import("qrcode");
  const svg = await QR.toString(uri, { type: "svg", margin: 1, width: 220 });
  return { secret, uri, svg };
}

export async function confirm2fa(id: string, code: string): Promise<boolean> {
  const sealed = await db.cmd<string | null>(["GET", `admin:2fa:pending:${id}`]);
  const secret = sealed ? open(sealed) : null;
  if (!secret || verifyTotp(secret, code) === null) return false;
  await db.cmd(["HSET", H, id, seal(secret)]);
  await db.cmd(["DEL", `admin:2fa:pending:${id}`]);
  return true;
}

export async function disable2fa(id: string) {
  await db.cmd(["HDEL", H, id]);
}

// Sign-in limits, shared by every server: 5 failures per address or 10 per account in 15 minutes.
const WINDOW = 900;
export async function signInBlocked(ip: string, account: string): Promise<boolean> {
  const [a, b] = await Promise.all([db.cmd<string | null>(["GET", `login:fail:ip:${ip}`]), db.cmd<string | null>(["GET", `login:fail:acct:${account}`])]);
  return Number(a ?? 0) >= 5 || Number(b ?? 0) >= 10;
}
export async function signInFailed(ip: string, account: string) {
  for (const k of [`login:fail:ip:${ip}`, `login:fail:acct:${account}`]) {
    await db.cmd(["INCR", k]);
    await db.cmd(["EXPIRE", k, WINDOW]);
  }
}
export async function signInCleared(ip: string, account: string) {
  await db.cmd(["DEL", `login:fail:ip:${ip}`, `login:fail:acct:${account}`]);
}

export async function signInAlert(who: string, ip: string, ua: string, twoStep: boolean) {
  const [{ sendEmail }, { REPORT_TO }] = await Promise.all([import("@/lib/email"), import("@/lib/neo-sync")]);
  const when = new Date().toLocaleString("en-GB", { timeZone: "Asia/Beirut" });
  const text = [
    `${who} signed in to the SuperYou admin.`,
    ``,
    `When: ${when} (Beirut)`,
    `IP address: ${ip}`,
    `Device: ${ua.slice(0, 160)}`,
    `Authenticator code used: ${twoStep ? "yes" : "no"}`,
    ``,
    `If this wasn't you or your team, change the admin password in Vercel now and remove the staff account in Admin → Staff.`,
  ].join("\n");
  for (const to of REPORT_TO) await sendEmail(to, `Admin sign-in: ${who}`, text).catch(() => false);
}
