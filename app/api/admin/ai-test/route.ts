import { NextResponse } from "next/server";
import { adminGuard } from "@/lib/admin-auth";
import { anthropicKey } from "@/lib/extras";

// Checks the Claude key: says what Anthropic answers (never shows the key).
export async function GET() {
  const denied = await adminGuard();
  if (denied) return denied;
  const key = await anthropicKey();
  if (!key) return NextResponse.json({ ok: false, error: "No key saved" });
  const model = process.env.ANTHROPIC_ADVISOR_MODEL || process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5";
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model, max_tokens: 10, messages: [{ role: "user", content: "Say OK" }] }),
  }).catch((e) => e as Error);
  if (r instanceof Error) return NextResponse.json({ ok: false, error: r.message });
  const body = await r.text();
  return NextResponse.json({ ok: r.ok, status: r.status, model, keyShape: `${key.slice(0, 7)}… (${key.length} chars)`, answer: body.slice(0, 400) });
}
