import "server-only";

/** Optional email via Resend (set RESEND_API_KEY and EMAIL_FROM). Without them, nothing is sent. */
export async function sendEmail(to: string, subject: string, text: string, attachments?: { filename: string; content: string }[]) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from || !to) return false;
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text, ...(attachments?.length ? { attachments } : {}) }), // attachment content: base64
  }).catch(() => null);
  return !!res?.ok;
}
