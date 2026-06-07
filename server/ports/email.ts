// server/ports/email.ts
// Email port (mock-first, ports/adapters) — mirrors the R2BL build's email port.
// Sends via Resend's REST API using node's global fetch (no npm dependency, so the
// esbuild bundle stays dependency-free).
//
// Gating note: sending is gated on RESEND_API_KEY presence, NOT on MOCK. The app
// runs MOCK=1 for mock *data*; we still want real lead alerts once the key is set.

export interface EmailMessage {
  subject: string;
  html: string;
  text: string;
}

export interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
  mocked?: boolean;
}

export interface EmailPort {
  send(msg: EmailMessage): Promise<EmailResult>;
}

const FROM = process.env.RESEND_FROM_EMAIL ?? "ask@equanamity.co";
const TO = process.env.RESEND_TO_EMAIL ?? "travis.mulenga@gmail.com";

// ── Mock (no key): logs, never sends ─────────────────────────────────────────
class MockEmail implements EmailPort {
  async send(msg: EmailMessage): Promise<EmailResult> {
    console.log(`[MockEmail] would send to ${TO}: "${msg.subject}" (set RESEND_API_KEY to send)`);
    return { success: true, mocked: true, messageId: `mock-${Date.now()}` };
  }
}

// ── Resend (key present): real send via REST ─────────────────────────────────
class ResendEmail implements EmailPort {
  constructor(private apiKey: string) {}
  async send(msg: EmailMessage): Promise<EmailResult> {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: FROM, to: [TO], subject: msg.subject, html: msg.html, text: msg.text }),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
      if (!res.ok) return { success: false, error: data.message ?? `HTTP ${res.status}` };
      return { success: true, messageId: data.id };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : String(e) };
    }
  }
}

export function createEmailPort(): EmailPort {
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendEmail(key) : new MockEmail();
}

export const emailRecipient = TO;
export const emailSender = FROM;
